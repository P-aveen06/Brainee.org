import hashlib
import io
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree

from graphrag_sdk import Context, FixedSizeChunking
from graphrag_sdk.ingestion.loaders.pdf_loader import PdfLoader

from .retrieval import query_terms, source_for


MAX_TEXT = 1_000_000
TEXT_TYPES = {"text/plain", "text/markdown", "text/csv", "application/json"}
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


async def extract_text(content, mime_type):
    if mime_type in TEXT_TYPES:
        return content.decode("utf-8-sig"), "indexed"
    if mime_type == "application/pdf":
        with tempfile.TemporaryDirectory(prefix="delivery-pdf-") as directory:
            path = Path(directory) / "source.pdf"
            path.write_bytes(content)
            loaded = await PdfLoader().load(str(path), Context(latency_budget_ms=15000))
            return loaded.text, "indexed"
    if mime_type == DOCX:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            info = archive.getinfo("word/document.xml")
            if info.file_size > 10 * 1024 * 1024:
                raise ValueError("Document XML exceeds the extraction limit.")
            xml = archive.read(info)
            if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
                raise ValueError("Document XML declarations are not supported.")
            root = ElementTree.fromstring(xml)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = ["".join(node.itertext()) for node in root.findall(".//w:p", ns)]
            return "\n".join(paragraphs), "indexed"
    return "", "unsupported"


async def index_document(graph, actor_id, document_id, content):
    document = await graph.document(actor_id, document_id)
    if len(content) > 25 * 1024 * 1024:
        raise ValueError("Document exceeds the 25 MB extraction limit.")
    checksum = hashlib.sha256(content).hexdigest()
    if not document["checksum"] or checksum != document["checksum"]:
        raise ValueError("Document content does not match the current source checksum.")
    text, status = await extract_text(content, document["mimeType"])
    if status == "indexed":
        status = "truncated" if len(text) > MAX_TEXT else "indexed" if text.strip() else "empty"
    text = text[:MAX_TEXT]
    # Only derived document properties are written. Business nodes/relationships are untouched.
    result = await graph.connection.graph.query("""
MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true
MATCH (d:DocumentVersion {id:$id}) WHERE d.checksum=$checksum AND d.status <> 'superseded'
SET d.deliveryText=$text,d.deliveryTextChecksum=$checksum,d.deliveryIndexStatus=$status
RETURN d.id""", params={"actorId": actor_id, "id": document["id"], "checksum": checksum,
                        "text": text, "status": status}, timeout=5000)
    if not result.result_set:
        raise ValueError("Document or caller changed during indexing. Retry retrieval.")
    return {"documentId": document["id"], "status": status, "characters": len(text)}


async def document_passages(graph, actor_id, payload):
    document = await graph.document(actor_id, payload["documentId"])
    text = document.pop("text") or ""
    document.pop("checksum", None)
    document.pop("mimeType", None)
    chunks = await FixedSizeChunking(chunk_size=3200, chunk_overlap=300).chunk(text, Context())
    terms = query_terms(payload.get("query", ""), payload.get("concepts", []))
    passages = []
    for chunk in chunks.chunks:
        matched = [term for term in terms if term in chunk.text.casefold()]
        if terms and not matched:
            continue
        source = source_for(document)
        source["label"] += f" passage {chunk.index + 1}"
        passages.append({"text": chunk.text, "position": chunk.index,
                         "startChar": chunk.metadata["start_char"],
                         "endChar": chunk.metadata["end_char"], "matchedConcepts": matched,
                         "score": len(matched), "source": source})
    passages.sort(key=lambda item: (-item["score"], item["position"]))
    offset, limit = payload.get("offset", 0), payload.get("limit", 10)
    selected = passages[offset:offset + limit]
    more = len(passages) > offset + limit
    return {"scope": "company_delivery", "document": document, "passages": selected,
            "totalMatchingPassages": len(passages), "totalPassages": len(chunks.chunks),
            "offset": offset, "hasMore": more, "nextOffset": offset + limit if more else None,
            "textTruncated": document["indexStatus"] == "truncated",
            "sources": [item["source"] for item in selected]}

