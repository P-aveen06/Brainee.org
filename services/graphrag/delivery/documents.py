import hashlib
import asyncio
import json
import time
from urllib.parse import quote

from graphrag_sdk import Context, FixedSizeChunking

from .retrieval import query_terms, source_for
from .extraction import extract_document


MAX_TEXT = 1_000_000
TEXT_TYPES = {"text/plain", "text/markdown", "text/csv", "application/json"}
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


async def record_index_failure(graph, actor_id, document_id):
    # Error categories only: exceptions can include source text or storage details.
    await graph.connection.graph.query("""MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true
MATCH (d:DocumentVersion {id:$id}) WHERE d.status<>'superseded'
WITH d,CASE WHEN d.deliveryAttemptChecksum=d.checksum THEN coalesce(d.deliveryIndexAttempts,0)+1 ELSE 1 END AS attempts
SET d.deliveryIndexAttempts=attempts,d.deliveryAttemptChecksum=d.checksum,
d.deliveryIndexStatus=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
d.deliveryRetryAt=$now+CASE WHEN attempts<5 THEN 60*pow(2,attempts-1) ELSE 3600 END,
d.deliveryIndexError='extraction_failed' RETURN d.id""", params={"actorId": actor_id,
        "id": document_id, "now": int(time.time())}, timeout=5000)


async def extract_text(content, mime_type):
    text, status, _ = await asyncio.to_thread(extract_document, content, mime_type)
    return text, status


async def index_document(graph, actor_id, document_id, content):
    document = await graph.document(actor_id, document_id)
    if len(content) > 25 * 1024 * 1024:
        raise ValueError("Document exceeds the 25 MB extraction limit.")
    checksum = hashlib.sha256(content).hexdigest()
    if not document["checksum"] or checksum != document["checksum"]:
        raise ValueError("Document content does not match the current source checksum.")
    text, status, locations = await asyncio.to_thread(extract_document, content, document["mimeType"])
    if status == "indexed":
        status = "truncated" if len(text) > MAX_TEXT else "indexed" if text.strip() else "empty"
    text = text[:MAX_TEXT]
    # Only derived document properties are written. Business nodes/relationships are untouched.
    result = await graph.connection.graph.query("""
MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true
MATCH (d:DocumentVersion {id:$id}) WHERE d.checksum=$checksum AND d.status <> 'superseded'
SET d.deliveryText=$text,d.deliveryTextChecksum=$checksum,d.deliveryIndexStatus=$status,
d.deliveryLocations=$locations,d.deliveryIndexAttempts=0,d.deliveryRetryAt=0,d.deliveryIndexError=null
RETURN d.id""", params={"actorId": actor_id, "id": document["id"], "checksum": checksum,
                        "text": text, "status": status, "locations": json.dumps(locations)}, timeout=5000)
    if not result.result_set:
        raise ValueError("Document or caller changed during indexing. Retry retrieval.")
    return {"documentId": document["id"], "status": status, "characters": len(text)}


async def document_passages(graph, actor_id, payload):
    document = await graph.document(actor_id, payload["documentId"])
    text = document.pop("text") or ""
    document.pop("checksum", None)
    document.pop("mimeType", None)
    locations = json.loads(document.pop("locations", None) or "[]")
    chunks = await FixedSizeChunking(chunk_size=3200, chunk_overlap=300).chunk(text, Context())
    terms = query_terms(payload.get("query", ""), payload.get("concepts", []))
    passages = []
    for chunk in chunks.chunks:
        matched = [term for term in terms if term in chunk.text.casefold()]
        if terms and not matched:
            continue
        source = source_for(document)
        source["label"] += f" passage {chunk.index + 1}"
        source["description"] = " ".join(chunk.text.split())[:480]
        source["url"] = f"/api/delivery/documents/{quote(document['id'], safe='')}/passages?position={chunk.index}"
        located = [location for location in locations if location["startChar"] < chunk.metadata["end_char"] and location["endChar"] > chunk.metadata["start_char"]]
        passages.append({"text": chunk.text, "position": chunk.index,
                         "startChar": chunk.metadata["start_char"],
                         "endChar": chunk.metadata["end_char"], "matchedConcepts": matched,
                         "score": len(matched), "source": source, "locations": located})
    passages.sort(key=lambda item: (-item["score"], item["position"]))
    offset, limit = payload.get("offset", 0), payload.get("limit", 10)
    selected = passages[offset:offset + limit]
    more = len(passages) > offset + limit
    return {"scope": "company_delivery", "document": document, "passages": selected,
            "totalMatchingPassages": len(passages), "totalPassages": len(chunks.chunks),
            "offset": offset, "hasMore": more, "nextOffset": offset + limit if more else None,
            "textTruncated": document["indexStatus"] == "truncated",
            "sources": [item["source"] for item in selected]}

