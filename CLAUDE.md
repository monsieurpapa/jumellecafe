# CLAUDE.md — jumelleCafe

Coffee/cacao traceability & EUDR-compliance platform for cooperatives in Sud-Kivu, DRC. pnpm workspace with 3 deployable apps + 3 shared `lib/*` packages. See the parent workspace `CLAUDE.md` for cross-project conventions.

## Apps

| App | Path | Stack | Deploys to |
|---|---|---|---|
| `api-server` | `artifacts/api-server` | Express | Railway |
| `web-admin` | `artifacts/web-admin` | Vite + React | Vercel |
| `field-pwa` | `artifacts/field-pwa` | Vite + React + PowerSync (offline PWA) | Vercel |

Shared packages (`lib/db`, `lib/shared`, `lib/ui`) export raw `.ts` source via `package.json` `exports`, not a pre-built `dist/`. **Any build step that runs plain `tsc -p` against them (not `tsc --build`) needs `pnpm run typecheck:libs` run first** to emit their `.d.ts` files — on a genuinely fresh clone (no `dist/`, no `.tsbuildinfo`, both gitignored) skipping this fails with `TS6305`. `api-server`'s own build (esbuild, not `tsc -p`) is unaffected. All three deploy configs below already account for this.

## Deploy Configuration (configured by /setup-deploy)

Three independent services in one repo — not the single-platform case this section usually describes.

### api-server → Railway
- Config: `railway.toml` (repo root)
- **Root Directory must stay the repo root** in the Railway service settings (not `artifacts/api-server`) — pnpm workspaces resolve `workspace:*` deps from the root.
- Build: `pnpm install --frozen-lockfile && pnpm run typecheck:libs && pnpm --filter @jumelle/api-server typecheck && pnpm --filter @jumelle/api-server build`
- Start: `pnpm --filter @jumelle/api-server start`
- Health check: `/api/healthz` (checks Supabase connectivity, returns 503 if unreachable)
- Env vars to set in Railway: `DATABASE_URL`, `SUPABASE_URL`, `SERVICE_ROLE_KEY`, `POWERSYNC_JWT_SECRET`, `POWERSYNC_URL` (`PORT` is injected by Railway automatically — the app already reads `process.env.PORT`)

### web-admin → Vercel
- Config: `artifacts/web-admin/vercel.json`
- Root Directory: `artifacts/web-admin` — enable **"Include files outside of the Root Directory in the Build Step"** in Vercel project settings (needed to reach `lib/*`)
- Env vars: `VITE_API_URL` (the Railway api-server URL), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### field-pwa → Vercel
- Config: `artifacts/field-pwa/vercel.json` — also sets `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Embedder-Policy: require-corp` on every response, required for the offline SQLite engine (wa-sqlite/SharedArrayBuffer); without these headers the app fails to boot offline.
- Root Directory: `artifacts/field-pwa` — same "include outside root directory" setting as web-admin
- Env vars: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POWERSYNC_URL`

### Database
Supabase Postgres — already provisioned and in active use (the same project backs local dev today). Schema changes go out via `pnpm --filter @jumelle/db push` (drizzle-kit push, no migration files — see `lib/db/drizzle.config.ts`) against `DATABASE_URL`.

### PowerSync (blocks field-pwa specifically)
`POWERSYNC_URL` / `POWERSYNC_JWT_SECRET` are **not provisioned yet** — empty even in local `.env`, so offline sync doesn't work anywhere yet, dev or prod. Needs a PowerSync Cloud project (or self-host) connected to the same Supabase Postgres via logical replication, with `powersync/sync-rules.yaml` deployed to it and custom-JWT auth configured to trust `POWERSYNC_JWT_SECRET` (HS256, issuer `jumellecafe-api`, audience `powersync` — see `artifacts/api-server/src/lib/powersyncJwt.ts`). api-server and web-admin don't need this to function.

### CORS
`api-server` currently allows all origins (`cors()` with no restriction) — fine since every endpoint requires a bearer token (no cookies), but worth tightening to the two Vercel domains once they're known post-first-deploy.

## Skill routing

When a request matches a gstack skill (bugs → `/investigate`, shipping → `/ship`, QA → `/qa`, design → `/design-review`, architecture → `/plan-eng-review`), invoke the skill first via the Skill tool before doing anything else.
