# WorkOS Callback Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exchange each WorkOS authorization code exactly once and restore TanStack Start's recommended CSRF protection.

**Architecture:** Move callback processing from a revalidating React loader to a server-only GET route handler that returns the existing session cookie and redirect in one HTTP response. Keep the WorkOS client and custom session format unchanged.

**Tech Stack:** TanStack Start 1.x, TanStack Router 1.x, WorkOS Node SDK 10.x, Vitest 4.x, TypeScript 6.x

## Global Constraints

- Preserve the existing custom `brainee_session` cookie format.
- Do not migrate to the WorkOS AuthKit TanStack Start SDK.
- Do not change the legacy `/callback` route.
- Do not create or amend Git commits.
- Do not modify the user's existing changes in `src/components/organization/OrgChartTree.tsx` or `src/routes/_authenticated.profile.tsx`.

---

### Task 1: Server-only WorkOS callback

**Files:**
- Create: `src/routes/-auth.callback.test.ts`
- Modify: `src/routes/auth.callback.tsx`

**Interfaces:**
- Consumes: `getWorkOS(): WorkOS`, `getWorkOSClientId(): string`, and `createSessionCookie(payload): Promise<string>`.
- Produces: `handleAuthCallbackRequest({ request }: { request: Request }): Promise<Response>`, registered as the route's GET handler.

- [ ] **Step 1: Write the failing success-path test**

Mock `#/lib/auth.server` before importing the route. The test calls `handleAuthCallbackRequest` with `/auth/callback?code=one-time-code`, then asserts that `authenticateWithCode` ran exactly once with `{ clientId: "client_test", code: "one-time-code" }`. It also asserts a 302 response with `Location: http://localhost:3000/` and `Set-Cookie: brainee_session=sealed; Path=/`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bun run test src/routes/-auth.callback.test.ts`

Expected: FAIL because `handleAuthCallbackRequest` is not exported by the loader-based route.

- [ ] **Step 3: Implement the GET route handler**

Replace the route loader/server function with a handler using this production shape:

```tsx
export async function handleAuthCallbackRequest({
  request,
}: {
  request: Request;
}): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    console.error(
      "[AuthCallback] Missing authorization code or error present:",
      error,
    );
    return redirectResponse(request, "/sign-in");
  }

  try {
    const response = await getWorkOS().userManagement.authenticateWithCode({
      clientId: getWorkOSClientId(),
      code,
    });
    const { user } = response;
    const cookie = await createSessionCookie({
      workosUserId: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      profilePictureUrl: user.profilePictureUrl ?? null,
    });
    return redirectResponse(request, "/", cookie);
  } catch (error: unknown) {
    console.error(
      "[AuthCallback] WorkOS authentication callback error:",
      error,
    );
    return redirectResponse(request, "/sign-in");
  }
}

export const Route = createFileRoute("/auth/callback")({
  server: { handlers: { GET: handleAuthCallbackRequest } },
});
```

`redirectResponse` creates an absolute same-origin `Location`, attaches `Set-Cookie` when supplied, and returns status 302.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `bun run test src/routes/-auth.callback.test.ts`

Expected: PASS with one test.

- [ ] **Step 5: Add failure-path tests**

Add one test that omits `code` and verifies no exchange plus a redirect to `/sign-in/$`. Add one test that rejects `authenticateWithCode` and verifies the same redirect without propagating the WorkOS error. Stub `console.error` in those tests so output stays clean.

- [ ] **Step 6: Run callback tests**

Run: `bun run test src/routes/-auth.callback.test.ts`

Expected: PASS with three tests.

### Task 2: Restore CSRF middleware and verify the app

**Files:**
- Modify: `src/start.ts`

**Interfaces:**
- Consumes: `createCsrfMiddleware` and `createStart` from `@tanstack/react-start`.
- Produces: a `startInstance` whose request middleware rejects cross-site server-function RPC requests.

- [ ] **Step 1: Register the CSRF middleware**

Use the framework-recommended configuration:

```ts
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
```

- [ ] **Step 2: Run automated verification**

Run `bun run test`, `bun run typecheck`, `bun run check`, and `bun run build` independently.

Expected: every command exits with status 0. If the repository-wide check reports pre-existing issues in untouched files, run it against only the changed files and report the unrelated failures without changing them.

- [ ] **Step 3: Verify the development warning is gone**

Start `bun run dev`, request `http://localhost:3000/`, and inspect startup/request output.

Expected: the server starts successfully and does not print `TanStack Start server functions are not protected by the CSRF middleware.`

- [ ] **Step 4: Review the final diff**

Run `git diff --check`, `git status --short`, and a scoped diff for the callback, test, and Start configuration.

Expected: no whitespace errors; only the planned files are changed by this task; the user's pre-existing modified files remain untouched.
