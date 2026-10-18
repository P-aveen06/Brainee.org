# WorkOS Callback Reliability Design

## Problem

The WorkOS authorization code is exchanged from the `/auth/callback` React route loader. Route loaders may revalidate in the browser, so the same one-time code can be submitted twice. The second submission fails with `invalid_grant` after the first has already consumed the code.

The app also defines an empty `requestMiddleware` array, which replaces TanStack Start's default CSRF protection and triggers its development warning.

## Approaches Considered

1. **Server-route callback (selected):** Handle `GET /auth/callback` before React routing, exchange the code once, set the existing custom session cookie, and return an HTTP redirect. This matches the framework and WorkOS callback model while preserving the current session implementation.
2. **Client loader guard:** Track whether the code was processed and suppress subsequent loader calls. This remains vulnerable to lifecycle and cross-request edge cases and leaves a destructive operation in a revalidating loader.
3. **Adopt the WorkOS AuthKit TanStack Start SDK:** Use its middleware and callback handler. This is a larger session/authentication migration than required for the reported failure.

## Design

- Replace the `/auth/callback` loader and server function with a `server.handlers.GET` callback.
- Read `code` and `error` from the incoming request URL.
- On success, call `authenticateWithCode` once, create the existing `brainee_session` cookie, and return a redirect response to `/` containing `Set-Cookie`.
- On a missing code, provider error, or exchange failure, log the failure and redirect to `/sign-in` without exposing provider details to the browser.
- Leave the legacy `/callback` route unchanged because it is not the configured redirect URI; removing or migrating it is outside this fix.
- Register `createCsrfMiddleware` in `src/start.ts`, filtered to server-function requests as recommended by TanStack Start.

## Verification

- Add focused tests for one successful exchange/redirect and callback failure behavior.
- Run the focused tests, full test suite, typecheck, formatting/lint checks, and production build.
- Confirm the dev server starts without the CSRF warning.
