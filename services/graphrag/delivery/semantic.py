"""Derived FalkorDB vector index; every hit is rehydrated from its current source."""
import asyncio
import hashlib
import time
import re
from collections import Counter

from .encoder import DIMENSIONS, MODEL_ID
from .graph import SEARCH_KINDS


def fingerprint(body):
    return hashlib.sha256(body.encode()).hexdigest()


def chunks(body):
    # Fit a passage in the encoder window; overlap avoids losing boundary meaning.
    return [(start, body[start:start + 900]) for start in range(0, max(1, len(body)), 750)]


class SemanticIndex:
    def __init__(self, graph, encoder):
        self.graph, self.encoder = graph, encoder
        self.stats = {"state": "starting", "indexedPassages": 0, "failures": 0, "lastCompletedAt": None}
        self.query_stats = Counter()
        self.last_latency_ms = 0

    async def setup(self):
        raw = self.graph.connection.graph
        definitions = [
            "CREATE INDEX FOR (e:DeliverySearchEntry) ON (e.key)",
            f"CREATE VECTOR INDEX FOR (e:DeliverySearchEntry) ON (e.embedding) OPTIONS {{dimension:{DIMENSIONS},similarityFunction:'cosine',efRuntime:100}}",
            "CREATE FULLTEXT INDEX FOR (e:DeliverySearchEntry) ON (e.text)",
        ]
        checksum = fingerprint("\n".join(definitions) + MODEL_ID)
        result = await raw.ro_query("MATCH (s:DeliveryIndexSchema {id:'v1'}) RETURN s.checksum", timeout=5000)
        if result.result_set and result.result_set[0][0] != checksum:
            raise RuntimeError("Delivery index schema checksum mismatch.")
        indexes = await raw.ro_query("CALL db.indexes() YIELD label,properties RETURN label,properties", timeout=5000)
        existing = {(row[0], prop) for row in indexes.result_set for prop in row[1]}
        for prop, ddl in zip(("key", "embedding", "text"), definitions):
            if ("DeliverySearchEntry", prop) not in existing:
                await raw.query(ddl, timeout=10000)
        await raw.query("MERGE (s:DeliveryIndexSchema {id:'v1'}) SET s.checksum=$checksum", params={"checksum": checksum}, timeout=5000)

    async def sync(self):
        """Bounded pages and batches, outside interactive requests. Check all sources each sweep."""
        raw = self.graph.connection.graph
        count = 0
        self.stats["state"] = "indexing"
        for kind, (match, body, _) in SEARCH_KINDS.items():
            # These fixed queries project delivery text only, including for Employee nodes.
            match = match.replace("WITH actor,p,p AS n", "WITH p,p AS n")
            offset = 0
            while True:
                result = await raw.ro_query(f"""{match}
WITH DISTINCT p,n,{body} AS body
RETURN n.id,p.id,body ORDER BY n.id,p.id SKIP $offset LIMIT 100""",
                    params={"offset": offset}, timeout=5000)
                count += await self.sync_page(kind, result.result_set)
                if len(result.result_set) < 100:
                    break
                offset += 100
                await asyncio.sleep(0)
        total = await raw.ro_query("MATCH (e:DeliverySearchEntry) WHERE e.complete=true AND e.modelId=$modelId RETURN count(e)",
                                  params={"modelId": MODEL_ID}, timeout=5000)
        self.stats.update(state="ready", indexedPassages=total.result_set[0][0],
                          updatedPassages=count, lastCompletedAt=int(time.time()))

    async def sync_page(self, kind, records):
        raw = self.graph.connection.graph
        keys = [f"{kind}:{source_id}:{project_id}:0" for source_id, project_id, _ in records]
        found = await raw.ro_query("""UNWIND $keys AS key MATCH (e:DeliverySearchEntry {key:key})
WHERE e.complete=true AND e.modelId=$modelId RETURN e.key,e.fingerprint""",
                                   params={"keys": keys, "modelId": MODEL_ID}, timeout=5000)
        existing, rows, sources = dict(found.result_set), [], []
        for source_id, project_id, text in records:
            text = text or ""
            stamp, key = fingerprint(text), f"{kind}:{source_id}:{project_id}"
            if existing.get(key + ":0") == stamp:
                continue
            sources.append({"id": source_id, "projectId": project_id, "fingerprint": stamp})
            for index, (start, passage) in enumerate(chunks(text)):
                rows.append({"key": f"{key}:{index}", "sourceId": source_id, "projectId": project_id,
                             "fingerprint": stamp, "start": start, "text": passage})
        label = {"task": "Task", "decision": "Comment", "document": "DocumentVersion",
                 "update": "DailyUpdate", "project": "Project", "person": "Employee"}[kind]
        for offset in range(0, len(rows), 32):
            batch = rows[offset:offset + 32]
            vectors = await self.encoder.encode([row["text"] for row in batch])
            for row, vector in zip(batch, vectors):
                row["vector"] = vector
            await raw.query(f"""UNWIND $rows AS row
MATCH (n:{label} {{id:row.sourceId}}),(p:Project {{id:row.projectId}})
MERGE (e:DeliverySearchEntry {{key:row.key}})
SET e.kind=$kind,e.sourceId=row.sourceId,e.projectId=row.projectId,e.fingerprint=row.fingerprint,
e.modelId=$modelId,e.startChar=row.start,e.text=row.text,e.embedding=vecf32(row.vector),e.complete=false
MERGE (e)-[:EVIDENCE_FOR]->(n) MERGE (e)-[:IN_PROJECT]->(p)""",
                params={"kind": kind, "modelId": MODEL_ID, "rows": batch}, timeout=5000)
        if sources:
            await raw.query("""UNWIND $sources AS source
MATCH (e:DeliverySearchEntry {sourceId:source.id,projectId:source.projectId,kind:$kind})
WHERE e.fingerprint=source.fingerprint AND e.modelId=$modelId SET e.complete=true""",
                params={"sources": sources, "kind": kind, "modelId": MODEL_ID}, timeout=5000)
            await raw.query("""UNWIND $sources AS source
MATCH (e:DeliverySearchEntry {sourceId:source.id,projectId:source.projectId,kind:$kind})
WHERE e.fingerprint<>source.fingerprint DETACH DELETE e""",
                params={"sources": sources, "kind": kind}, timeout=5000)
        return len(rows)

    async def run(self):
        while True:
            try:
                await self.sync()
            except asyncio.CancelledError:
                raise
            except Exception:
                self.stats["failures"] += 1
                self.stats["state"] = "degraded"
            await asyncio.sleep(30)

    async def search(self, actor_id, query, ceiling):
        started = time.monotonic()
        await self.graph.authenticate(actor_id)
        vector = await self.encoder.query(query)
        hits = await self.graph.read("""CALL db.idx.vector.queryNodes('DeliverySearchEntry','embedding',$limit,vecf32($vector))
YIELD node,score WHERE node.modelId=$modelId AND node.complete=true AND score<=0.72
RETURN {id:node.sourceId,projectId:node.projectId,kind:node.kind,fingerprint:node.fingerprint,
startChar:node.startChar,text:node.text,similarity:1-score} ORDER BY score ASC""",
            actor_id, vector=vector, limit=min(500, ceiling * 3), modelId=MODEL_ID)
        records = await self.current_hits(actor_id, hits, ceiling)
        self.last_latency_ms = round((time.monotonic() - started) * 1000)
        self.query_stats["semanticQueries"] += 1
        return records

    async def lexical(self, actor_id, terms, ceiling):
        tokens = list(dict.fromkeys(re.findall(r"[\w]+", " ".join(terms))))[:64]
        if not tokens:
            return []
        hits = await self.graph.read("""CALL db.idx.fulltext.queryNodes('DeliverySearchEntry',$searchText)
YIELD node,score WHERE node.complete=true AND node.modelId=$modelId
RETURN {id:node.sourceId,projectId:node.projectId,kind:node.kind,fingerprint:node.fingerprint,
startChar:node.startChar,text:node.text,similarity:score} ORDER BY score DESC LIMIT $limit""",
            actor_id, searchText="|".join(tokens), modelId=MODEL_ID, limit=min(500, ceiling * 3))
        rows = await self.current_hits(actor_id, hits, ceiling)
        for row in rows:
            row["matched"] = [term for term in terms if term in row["body"].casefold()]
            row["score"] = row.pop("semanticScore")  # Full-text scores are not cosine similarities.
        return rows

    async def current_hits(self, actor_id, hits, ceiling):
        records = []
        for kind in SEARCH_KINDS:
            selected = [hit for hit in hits if hit["kind"] == kind]
            if not selected:
                continue
            rows = await self.graph.hydrate(actor_id, kind, selected)
            for row in rows:
                matches = [hit for hit in selected if hit["id"] == row["item"]["id"] and
                           hit["projectId"] == row["item"]["projectId"] and hit["fingerprint"] == fingerprint(row["body"])]
                if not matches:
                    continue  # Changed, superseded, deleted, or inaccessible evidence is never replayed.
                hit = max(matches, key=lambda value: value["similarity"])
                row.update(semanticScore=hit["similarity"], passageStart=hit["startChar"], passageText=hit["text"])
                records.append(row)
        records.sort(key=lambda row: (-row["semanticScore"], row["item"]["id"]))
        return records[:ceiling]
