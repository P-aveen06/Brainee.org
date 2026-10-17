import asyncio
import json
import re

from graphrag_sdk import Context, RetrievalStrategy
from graphrag_sdk.core.models import RawSearchResult, RetrieverResult, RetrieverResultItem

from .graph import SEARCH_KINDS


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
    return {"id": item["id"], "type": kind, "label": label, "projectId": item["projectId"]}


class DeliveryRetrieval(RetrievalStrategy):
    """SDK strategy for the application's native graph, without copying business records.

    Uses the SDK search/Context/result contracts and parameterized native graph expansion.
    The default SDK document ontology is intentionally not imposed on app nodes.
    """
    async def _execute(self, query, ctx: Context, **kwargs):
        actor_id = ctx.metadata["actorId"]
        terms = query_terms(query, ctx.metadata.get("concepts", []))
        if not terms:
            raise ValueError("Describe a functionality, task, person, or project to search.")
        offset, limit = ctx.metadata.get("offset", 0), ctx.metadata.get("limit", 15)
        ceiling = offset + limit + 1
        ctx.ensure_budget("delivery graph search")
        groups = await asyncio.gather(*[
            self._graph.search_kind(actor_id, kind, terms, ceiling) for kind in SEARCH_KINDS
        ])
        records = []
        for group in groups:
            for row in group:
                item = row["item"]
                text, start, shortened = excerpt(row["body"], row["matched"])
                item.update(excerpt=text, excerptStart=start, excerptTruncated=shortened,
                            matchedConcepts=row["matched"], score=row["score"])
                item["source"] = source_for(item)
                records.append(item)
        records.sort(key=lambda item: (-item["score"], item["projectCode"], item["type"], item["id"]))
        unique = {f"{item['type']}:{item['id']}:{item['projectId']}": item for item in records}
        ordered = sorted(unique.values(), key=lambda item: (-item["score"], item["projectCode"], item["id"]))
        return RawSearchResult(records=ordered, metadata={
            "scope": "company_delivery", "terms": terms, "offset": offset, "limit": limit,
            "hasMore": len(ordered) > offset + limit,
            "ranking": "concept_overlap_and_graph_links", "sdk": "graphrag-sdk/1.4.0",
        })

    def _format(self, raw):
        return RetrieverResult(items=[RetrieverResultItem(
            content=json.dumps(item, ensure_ascii=False), metadata={"record": item}, score=item["score"],
        ) for item in raw.records], metadata=raw.metadata)


async def search_delivery(graph, actor_id, payload):
    ctx = Context(latency_budget_ms=10000, metadata={"actorId": actor_id, **payload})
    result = await DeliveryRetrieval(graph_store=graph).search(payload["query"], ctx)
    offset, limit = payload.get("offset", 0), payload.get("limit", 15)
    selected = [item.metadata["record"] for item in result.items[offset:offset + limit]]
    return {"matches": selected, **result.metadata,
            "nextOffset": offset + limit if result.metadata["hasMore"] else None,
            "sources": [item["source"] for item in selected],
            "documentCoverage": await graph.coverage(actor_id)}

