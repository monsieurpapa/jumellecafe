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

### PowerSync
Provisioned on PowerSync Cloud (org `monsieurpapa`, project `jumellecafe`, instance `Development`). `POWERSYNC_URL` / `VITE_POWERSYNC_URL` are set to the instance URL and `POWERSYNC_JWT_SECRET` (base64url) is set in local `.env` — set the same three in Railway/Vercel for non-local deploys.

- **Source connection**: instance connects to Supabase's *direct* connection (`db.<ref>.supabase.co:5432`, IPv6 — resolves fine from PowerSync Cloud's own network even though it won't resolve from an IPv6-less sandbox), `verify-full` SSL with no manually-uploaded certificate (PowerSync bundles Supabase's CA). Auth role is `powersync_role` (`REPLICATION`, `BYPASSRLS`, `SELECT` on all tables + `ALTER DEFAULT PRIVILEGES` for future ones), and the Postgres publication `powersync` is `FOR ALL TABLES` — both created directly via SQL against `DATABASE_URL`, following PowerSync's official Supabase setup.
- **Sync rules**: the dashboard's current default config format is edition-3 **Sync Streams** (`config: {edition: 3}` + `streams:`), not the older `bucket_definitions` sync-rules format `powersync/sync-rules.yaml` is written in and documents — deploy by pasting that file's `queries` block into the dashboard's Sync Streams editor (Validate, then Deploy), there's no CLI/API deploy path wired up yet. Every column is explicitly aliased snake_case→camelCase (`cooperative_id AS "cooperativeId"`) because PowerSync delivers whatever column names the query produces verbatim — an unaliased `SELECT *` would sync every field as NULL against `field-pwa/src/powersync/schema.ts`'s camelCase columns.
- **Client auth**: instance trusts a custom HS256 token via Client Auth → "HS256 authentication tokens (advanced)", KID `jumellecafe-api`, matching `mintPowerSyncToken()` in `artifacts/api-server/src/lib/powersyncJwt.ts` (issuer `jumellecafe-api`, audience `powersync`, registered as an accepted `JWT Audience` value on the instance too). The secret is stored/compared as base64url — `powersyncJwt.ts` base64url-decodes `POWERSYNC_JWT_SECRET` into a `Buffer` before signing so both sides use the same raw key bytes, not the literal secret string's UTF-8 bytes.
- api-server and web-admin don't need any of this to function — only field-pwa's offline sync depends on it.

### CORS
`api-server` currently allows all origins (`cors()` with no restriction) — fine since every endpoint requires a bearer token (no cookies), but worth tightening to the two Vercel domains once they're known post-first-deploy.

## Skill routing

When a request matches a gstack skill (bugs → `/investigate`, shipping → `/ship`, QA → `/qa`, design → `/design-review`, architecture → `/plan-eng-review`), invoke the skill first via the Skill tool before doing anything else. For customer acquisition/GTM/growth/launch questions → invoke `/growth-playbook` (workspace-local, not a gstack skill).
