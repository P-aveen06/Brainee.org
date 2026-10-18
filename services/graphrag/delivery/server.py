import asyncio
import hmac
import logging

from aiohttp import web
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from graphrag_sdk import FalkorDBConnection

from .config import Settings
from .context import implementation_context
from .documents import document_passages, index_document, record_index_failure
from .graph import DeliveryGraph
from .retrieval import search_delivery
from .encoder import LocalEncoder
from .semantic import SemanticIndex


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(default="", max_length=2000)
    concepts: list[str] = Field(default_factory=list, max_length=24)
    projectId: str = Field(default="", max_length=200)
    taskId: str = Field(default="", max_length=200)
    documentId: str = Field(default="", max_length=200)
    section: str = Field(default="all", max_length=20)
    offset: int = Field(default=0, ge=0, le=10000)
    limit: int = Field(default=25, ge=1, le=100)


class Envelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    actorId: str = Field(min_length=1, max_length=200)
    operation: str = Field(max_length=80)
    payload: Payload


def create_app(settings, graph=None):
    connection = FalkorDBConnection(settings.connection) if graph is None else None
    graph = graph or DeliveryGraph(connection)
    app = web.Application(client_max_size=25 * 1024 * 1024)
    handlers = {"delivery.search": search_delivery, "delivery.context": implementation_context,
                "delivery.passages": document_passages}

    async def start(_app):
        if connection:
            graph.semantic = SemanticIndex(graph, LocalEncoder())
            await graph.semantic.setup()
            app["semantic_task"] = asyncio.create_task(graph.semantic.run())

    async def operation(request):
        supplied = request.headers.get("authorization", "")
        if not hmac.compare_digest(supplied, f"Bearer {settings.token}"):
            return web.json_response({"error": "Unauthorized."}, status=401)
        try:
            envelope = Envelope.model_validate(await request.json())
            handler = handlers.get(envelope.operation)
            if handler is None:
                return web.json_response({"error": "Operation is not permitted."}, status=400)
            payload = envelope.payload.model_dump()
            if any(not isinstance(term, str) or len(term) > 120 for term in payload["concepts"]):
                raise ValueError("Search concepts must be at most 120 characters each.")
            async with asyncio.timeout(10):
                await graph.authenticate(envelope.actorId)
                data = await handler(graph, envelope.actorId, payload)
            return web.json_response({"data": data})
        except (ValidationError, ValueError, PermissionError):
            return web.json_response({"error": "Invalid or unavailable delivery source. Check the query and source IDs."}, status=400)
        except Exception:
            return web.json_response({"error": "Delivery retrieval is unavailable. Retry shortly."}, status=503)

    async def index(request):
        if not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {settings.token}"):
            return web.json_response({"error": "Unauthorized."}, status=401)
        actor_id = request.headers.get("x-graph-actor", "")
        if not actor_id or len(actor_id) > 200:
            return web.json_response({"error": "Invalid actor."}, status=400)
        try:
            async with asyncio.timeout(25):
                await graph.authenticate(actor_id)
                content = await request.read()
                data = await index_document(graph, actor_id, request.match_info["id"], content)
            return web.json_response({"data": data})
        except web.HTTPRequestEntityTooLarge:
            return web.json_response({"error": "Document exceeds 25 MB."}, status=413)
        except Exception:
            try:
                await record_index_failure(graph, actor_id, request.match_info["id"])
            except Exception:
                pass  # The failed operation remains a failure, including if the store is unavailable.
            return web.json_response({"error": "Document could not be indexed. Verify its format and checksum."}, status=400)

    async def ready(request):
        if not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {settings.token}"):
            return web.json_response({"error": "Unauthorized."}, status=401)
        try:
            await graph.connection.graph.ro_query("RETURN 1", timeout=3000)
            return web.json_response({"status": "ready", "sdk": "graphrag-sdk/1.4.0",
                                      "retrieval": {**graph.semantic.stats,
                                          "queries": dict(graph.semantic.query_stats),
                                          "lastSemanticLatencyMs": graph.semantic.last_latency_ms}
                                      if graph.semantic else {"state": "disabled"}})
        except Exception:
            return web.json_response({"error": "GraphRAG is unavailable."}, status=503)

    async def close(_app):
        task = app.get("semantic_task")
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        if connection:
            await connection.close()

    app.router.add_post("/operations", operation)
    app.router.add_post("/documents/{id}/index", index)
    app.router.add_get("/ready", ready)
    app.on_startup.append(start)
    app.on_cleanup.append(close)
    return app


if __name__ == "__main__":
    # SDK failures can contain source text/query details; never expose those in HTTP/logs.
    logging.getLogger("graphrag_sdk").setLevel(logging.CRITICAL)
    settings = Settings.from_env()
    web.run_app(create_app(settings), host="0.0.0.0", port=settings.port, access_log=None)

