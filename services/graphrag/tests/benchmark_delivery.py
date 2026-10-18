"""Opt-in scale check on a fresh disposable test graph, never the demo graph."""
import asyncio
import json
import os
import statistics
import time
import uuid

from graphrag_sdk import ConnectionConfig, FalkorDBConnection
from delivery.encoder import LocalEncoder
from delivery.graph import DeliveryGraph
from delivery.semantic import SemanticIndex
from delivery.retrieval import search_delivery


async def main():
    name = "brainee_test_rag_bench_" + uuid.uuid4().hex
    connection = FalkorDBConnection(ConnectionConfig(host=os.environ.get("GRAPH_TEST_HOST", "127.0.0.1"),
        port=int(os.environ["GRAPH_TEST_PORT"]), graph_name=name, retry_count=1))
    count = int(os.environ.get("GRAPH_BENCH_RECORDS", "1000"))
    if count < 100 or count > 10000:
        raise ValueError("Benchmark size must be 100–10000 tasks.")
    try:
        await connection.graph.query("""CREATE (:Employee {id:'reader',isActive:true}),
(:Project {id:'benchmark',code:'BENCH',name:'Scale corpus'})""")
        for offset in range(0, count, 100):
            rows = [{"id": f"task-{i}", "title": f"Archive report {i}",
                     "description": "Format operating summaries and store monthly audit reports."}
                    for i in range(offset, min(offset + 100, count))]
            if offset == 0:
                rows[0].update(title="Card checkout processing", description="Collect credit card payments with gateway authorization and capture.")
            await connection.graph.query("""MATCH (p:Project {id:'benchmark'}) UNWIND $rows AS row
CREATE (t:Task {id:row.id,projectId:p.id,title:row.title,description:row.description,status:'done'})
MERGE (p)-[:HAS_TASK]->(t)""", params={"rows": rows})
        graph = DeliveryGraph(connection)
        graph.semantic = SemanticIndex(graph, LocalEncoder())
        await graph.semantic.setup()
        started = time.monotonic()
        await graph.semantic.sync()
        indexing_ms = round((time.monotonic() - started) * 1000)
        latencies, hits = [], 0
        for query in ["Collect money from a customer's credit card", "Accept card payment", "Checkout gateway authorization"] * 5:
            result = await search_delivery(graph, "reader", {"query": query, "limit": 10})
            latencies.append(result["diagnostics"]["latencyMs"])
            hits += any(item["id"] == "task-0" for item in result["matches"])
        ordered = sorted(latencies)
        print("SCALE_BENCHMARK " + json.dumps({"tasks": count, "indexingMs": indexing_ms,
            "queries": len(latencies), "targetRecallAt10": hits / len(latencies),
            "latencyMedianMs": statistics.median(latencies), "latencyP95Ms": ordered[int(len(ordered) * .95)]}))
        assert hits == len(latencies)
        assert ordered[-1] < 10000
    finally:
        assert name.startswith("brainee_test_rag_bench_")
        await connection.graph.delete()
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
