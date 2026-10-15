/**
 * Stand-in for the `cloudflare:workers` runtime module under vitest (node environment).
 * Server modules read bindings through it; in tests there are none, so `env` is empty
 * and env-var lookups fall through to `process.env` exactly as they do locally.
 */
export const env: Record<string, string> = {};
