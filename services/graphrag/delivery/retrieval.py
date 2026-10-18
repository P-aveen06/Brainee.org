import asyncio
import json
import re
import time
from collections import Counter

from graphrag_sdk import Context, RetrievalStrategy
from graphrag_sdk.core.models import RawSearchResult, RetrieverResult, RetrieverResultItem

from .graph import SEARCH_KINDS
from .vocabulary import expand_vocabulary


STOP = set("a an and are as at be been built build by can company could develop developed "
           "did do does for from functionality give has have how i in is it me of on or our "
           "project projects requirement requirements similar some that the there this to "
           "use used want was we were what which who with would you".split())


def query_terms(query, concepts):
    # The assistant supplies semantic alternatives; its output is data, never Cypher.
    words = [word for word in re.findall(r"[\w]+", query.casefold())
             if len(word) >= 2 and word not in STOP]
    phrases = [str(term).strip().casefold() for term in concepts if str(term).strip()]
    return list(dict.fromkeys(phrases + words))[:24]


def excerpt(body, terms, length=1600):
    positions = [body.casefold().find(term) for term in terms]
    start = max(0, min((pos for pos in positions if pos >= 0), default=0) - 200)
    return body[start:start + length], start, start + length < len(body)


def source_for(item):
    kind, code = item["type"], item["projectCode"]
    if kind == "task":
        label = f"{code} #{item['taskNumber']}"
    elif kind == "project":
        label = f"{code} {item['title']}"
    else:
        label = f"{code} {kind}: {item.get('title', '')[:100]}"
        if kind == "document":
            label += f" v{item['version']}"
        elif kind == "update":
            label += f" {item.get('date', '')}"
        elif kind in ("decision", "discussion"):
            label += f" {item.get('excerpt', '')[:70]}"
        label += f" ({item['id']})"
    label = re.sub(r"\s+", " ", label).replace("[", "(").replace("]", ")").strip()
    description = next((item.get(field) for field in
                        ("excerpt", "summary", "description", "text", "body")
                        if isinstance(item.get(field), str) and item[field].strip()), "")
    if not description:
        details = [item.get("status"), item.get("priority"), item.get("assigneeName"),
                   item.get("projectRole"), item.get("category")]
        description = " · ".join(str(value) for value in details if value)
    description = re.sub(r"\s+", " ", str(description)).strip()[:480]
    source = {"id": item["id"], "type": kind, "label": label,
              "projectId": item["projectId"]}
    if description:
        source["description"] = description
    return source


class DeliveryRetrieval(RetrievalStrategy):
    """SDK strategy for the application's native graph, without copying business records.

    Uses the SDK search/Context/result contracts and parameterized native graph expansion.
    The default SDK document ontology is intentionally not imposed on app nodes.
    """
    async def _execute(self, query, ctx: Context, **kwargs):
        actor_id = ctx.metadata["actorId"]
        terms = expand_vocabulary(query_terms(query, ctx.metadata.get("concepts", [])))
        if not terms:
            raise ValueError("Describe a functionality, task, person, or project to search.")
        offset, limit = ctx.metadata.get("offset", 0), ctx.metadata.get("limit", 15)
        ceiling = min(500, max(50, offset + limit + 1))
        ctx.ensure_budget("delivery graph search")
        semantic = getattr(self._graph, "semantic", None)
        if semantic and semantic.stats.get("indexedPassages", 0):
            groups = [await semantic.lexical(actor_id, terms, ceiling)]
        else:
            groups = await asyncio.gather(*[
                self._graph.search_kind(actor_id, kind, terms, ceiling) for kind in SEARCH_KINDS
            ])
        lexical = sorted([row for group in groups for row in group],
                         key=lambda row: (-row["score"], row["item"]["id"]))
        semantic_rows = await semantic.search(actor_id, query, ceiling) if semantic else []
        records = {}
        for channel, rows in (("lexical", lexical), ("semantic", semantic_rows)):
            for rank, row in enumerate(rows):
                item = row["item"]
                key = f"{item['type']}:{item['id']}:{item['projectId']}"
                text, start, shortened = excerpt(row["body"], row["matched"])
                if channel == "semantic":
                    text, start = row["passageText"], row["passageStart"]
                    shortened = start > 0 or len(text) < len(row["body"])
                item.update(excerpt=text, excerptStart=start, excerptTruncated=shortened,
                            matchedConcepts=row["matched"], semanticScore=row.get("semanticScore"))
                item["source"] = source_for(item)
                existing = records.setdefault(key, {**item, "score": 0, "retrievalReasons": []})
                existing["score"] += 1 / (60 + rank + 1)
                existing["retrievalReasons"].append(channel)
                if channel == "semantic":
                    existing["semanticScore"] = row["semanticScore"]
                if item.get("title", "").casefold() == query.strip().casefold():
                    existing["score"] += 0.03
                if item["type"] == "decision":
                    existing["score"] += 0.002
        ordered = sorted(records.values(), key=lambda item: (-item["score"], item["projectCode"], item["id"]))
        seeds = [item["id"] for item in ordered[:12] if item["type"] == "task"]
        related = await self._graph.related_tasks(actor_id, seeds, 30) if seeds and hasattr(self._graph, "related_tasks") else []
        if seeds and hasattr(self._graph, "linked_evidence"):
            related += await self._graph.linked_evidence(actor_id, seeds, 20)
        for row in related:
            item = row["item"]
            key = f"{item['type']}:{item['id']}:{item['projectId']}"
            if key in records:
                records[key]["evidencePath"] = row["evidencePath"]
                continue
            item.update(excerpt=row["body"][:1600], excerptStart=0,
                        excerptTruncated=len(row["body"]) > 1600, matchedConcepts=[],
                        score=0.006, retrievalReasons=["graph_link"], evidencePath=row["evidencePath"])
            item["source"] = source_for(item)
            records[key] = item
        ordered = sorted(records.values(), key=lambda item: (-item["score"], item["projectCode"], item["id"]))
        return RawSearchResult(records=ordered, metadata={
            "scope": "company_delivery", "terms": terms, "offset": offset, "limit": limit,
            "hasMore": len(ordered) > offset + limit,
            "ranking": "reciprocal_rank_fusion_title_decision_and_graph_links", "sdk": "graphrag-sdk/1.4.0",
            "retrievalCoverage": {"semantic": semantic.stats if semantic else {"state": "disabled"},
                                  "candidateLimit": ceiling, "graphLinkedRecords": len(related)},
        })

    def _format(self, raw):
        return RetrieverResult(items=[RetrieverResultItem(
            content=json.dumps(item, ensure_ascii=False), metadata={"record": item}, score=item["score"],
        ) for item in raw.records], metadata=raw.metadata)


async def search_delivery(graph, actor_id, payload):
    started = time.monotonic()
    ctx = Context(latency_budget_ms=10000, metadata={"actorId": actor_id, **payload})
    result = await DeliveryRetrieval(graph_store=graph).search(payload["query"], ctx)
    offset, limit = payload.get("offset", 0), payload.get("limit", 15)
    selected = [item.metadata["record"] for item in result.items[offset:offset + limit]]
    return {"matches": selected, **result.metadata,
            "nextOffset": offset + limit if result.metadata["hasMore"] else None,
            "sources": [item["source"] for item in selected],
            "documentCoverage": await graph.coverage(actor_id),
            "diagnostics": {"latencyMs": round((time.monotonic() - started) * 1000),
                            "sourceContributions": dict(Counter(item["type"] for item in selected))}}

