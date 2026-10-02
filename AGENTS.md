<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aurora — project notes

- Verify every change with: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Deterministic offline scenario for UI work: `/results?demo=true` (fixed clock, no network).
- Scoring is pure and lives in `src/lib/scoring/`; weights are in `VIEWING_WEIGHTS`. Keep viewing score (sky only) and
  recommendation score (travel, roads) separate. Closed/difficult roads must never be recommended.
- External data enters only through adapters in `src/features/*` and is validated with zod; the engine
  (`src/features/recommendations/engine.ts`) depends only on the interfaces in `src/domain/providers.ts`.
- Next.js 16.3 specifics used here: async `params`/`searchParams`, error boundaries receive `retry` (not `reset`).
- MapLibre v6 is ESM-only: its worker is copied to `public/maplibre/` by `scripts/copy-maplibre-worker.mjs`
  (postinstall/predev/prebuild) and registered with `setWorkerUrl`.
- IRCA asks that road geometry is not fetched many times a day — keep the 24 h cache.
