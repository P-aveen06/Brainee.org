# Debug report: TanStack Start dev dependency optimization

- **Symptom:** `npm run dev` exited during Vite dependency optimization because Rolldown could not resolve `#tanstack-router-entry` and `#tanstack-start-entry` from `@tanstack/start-server-core`.
- **Root cause:** TanStack Start creates Vite resolve aliases for the app's router and start entries, but Vite 8's dependency optimizer uses a separate Rolldown resolution path. Those aliases were absent from both optimizer configurations, so package-private entry imports were treated as undefined package imports.
- **Fix:** `vite.config.ts` now passes the generated router and start entry paths to `optimizeDeps.rolldownOptions.resolve.alias` and `ssr.optimizeDeps.rolldownOptions.resolve.alias`.
- **Evidence:** The unmodified config reproduced the two resolution errors. With the fix, `npm run dev` reached Vite ready; `/@vite/client` and `/src/router.tsx` returned 200; `/sign-in/demo` returned 200; a warmed `/` request redirected to sign-in (307). The first cold `/` request took longer than the short probe timeout, then succeeded on retry.
- **Regression test:** `src/vite-config.test.ts` asserts both optimizer configurations carry both aliases. It failed when the optimizer config entries were temporarily removed and passed after restoration.
- **Checks:** `bun run test` passed (56 files, 305 tests); `bun run typecheck`, `bun run build`, and targeted Biome checks passed.
- **Related:** Vite emits an upstream `optimizeDeps.rollupOptions` deprecation warning during build from plugin configuration; it did not cause this error. The Node `punycode` warning is also unrelated.
- **Status:** DONE.
