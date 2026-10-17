# Delivery Graph RAG: deployment constraints

Status: architecture assessment, 17 October 2026. Retrieval implementation has not started.

## Confirmed product scope

- Discover previous functionality across company projects, including tasks, blockers,
  estimates, recorded actual effort, decisions, documents, and project contributors.
- Delivery knowledge is readable across projects by active employees, independent of
  project membership. This does not grant editing rights or access to private HR data.
- Use FalkorDB's official GraphRAG SDK. Task assignment is a separate future tool.
- Build retrieval first. A later task-plan flow will create approved task hierarchies
  in a destination project with reference links, estimates, and assumptions.
- Cloudflare deployment compatibility and use of its Free plan must guide the design.
  Vercel is another hosting candidate; no paid hosting budget has been confirmed.
- All development and verification remain local; production is off-limits.

## Verified platform constraints

Cloudflare supports Python Workers through Pyodide/WebAssembly. This is not an ordinary
Python server environment. Packages must be pure Python, available in Pyodide, or have
compatible WebAssembly wheels; threading and multiprocessing are not functional.

The published `graphrag-sdk==1.4.0` dependency set includes GLiNER, hnswlib, NumPy, and
SciPy. GLiNER also brings PyTorch. Running the unchanged SDK inside a Python Worker has
not been verified and must not be assumed supported. A normal Docker/Python service is
also not a Free Worker: Cloudflare Containers require the Workers Paid plan.

Workers Free currently permits 100,000 requests/day, 10 ms CPU/request, and 128 MB memory.
Waiting for network I/O is excluded from CPU time. Authentication, SSR, JSON processing,
and streaming still consume CPU; successful local builds do not prove Free-plan fit.

The existing app already calls an external private Node graph service through
`src/db/transport.server.ts`. Both that service and FalkorDB need a deployment host;
the current `compose.yaml` is a local Docker setup, not a Cloudflare deployment.

## Proposed layout if external hosting is acceptable

```text
Browser
  -> Cloudflare Worker: app, session authentication, HTTP orchestration/streaming
       -> authenticated HTTPS graph/retrieval backend
            -> existing Node domain operations
            -> official Python GraphRAG SDK
            -> FalkorDB
```

The SDK can share infrastructure with the existing graph backend. Document extraction,
indexing, embedding/ranking, and graph expansion run there. The Worker sends requests
and returns evidence/streamed answers. Backend identity is derived from the signed
session; the LLM cannot supply a different actor or arbitrary executable graph queries.

This keeps Cloudflare on its Free plan subject to measured usage and CPU limits.
External backend/database hosting and model inference have independent costs and
quotas. No zero-cost promise is made for the whole system.

If the entire system must run exclusively on Cloudflare Free, the current FalkorDB
and official SDK requirements need to be reconsidered before implementation.

## Vercel alternative

Vercel supports ordinary Python Functions. Its Hobby plan currently includes 4 active
CPU-hours, 360 GB-hours of provisioned memory, 1 million function invocations, and
100 GB fast data transfer per month. With Fluid compute, its function duration cap is
300 seconds. The standard Python bundle cap is 500 MB uncompressed; the SDK's complete
Linux dependency bundle and cold-start behavior still need validation.

Hobby is restricted to non-commercial personal use. For an operational company
application, plan around Pro rather than assume eligibility for Hobby. Pro currently
starts at USD 20/month, with usage charges and additional seats subject to the plan.
The SDK being Python-compatible does not settle FalkorDB database hosting, document
storage, or model inference costs.

The retrieval HTTP contract should remain portable between Cloudflare and Vercel.
The current application uses Cloudflare-specific R2 bindings, so changing the app's
host would also require adapting document storage access and the framework build.

## Implementation gates

1. Confirm whether an external graph/SDK backend is acceptable.
2. Pin and validate the official SDK APIs against the existing application graph.
3. Keep source records authoritative; preserve IDs, task hierarchy, original estimates,
   document versions, and provenance in retrieved evidence.
4. Restrict retrieval to company delivery fields and recheck active identity. Keep
   existing domain mutation authorization and confirmation rules.
5. Verify graph retrieval, cross-project discovery, estimates, citations, and document
   indexing against disposable local fixtures.
6. Build the actual Worker artifact and measure bundle size, CPU, memory, and request
   counts under representative usage before claiming Free-plan compatibility.

## Sources

- [Python Workers](https://developers.cloudflare.com/workers/languages/python/)
- [Supported packages](https://developers.cloudflare.com/workers/languages/python/packages/)
- [Python standard library limitations](https://developers.cloudflare.com/workers/languages/python/stdlib/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)
- [GraphRAG SDK dependencies](https://github.com/FalkorDB/GraphRAG-SDK/blob/main/graphrag_sdk/pyproject.toml)
- [Vercel Hobby allowances](https://vercel.com/docs/plans/hobby)
- [Vercel fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python)
- [Vercel pricing](https://vercel.com/pricing)
