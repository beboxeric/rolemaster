# RoleMaster

> AI capability delivery platform — package AI products as reusable RolePacks of skills + knowledge + connections, and deploy them like hiring a role.

Three role-separated portals on one stack:

| Portal | Who | Color |
|---|---|---|
| **Supplier** | AI consulting firms packaging their products | green |
| **Curator** | RoleMaster review team that approves and publishes RolePacks | purple |
| **Sales** | Sales reps browsing the published catalog for customers | blue |

## Stack

- **Frontend** — React 18 + Vite, react-router-dom. Bilingual (zh / en), themed per platform.
- **Backend** — Cloudflare Pages Functions. Pure Web-platform APIs (Web Crypto for JWT + PBKDF2; no Node deps in the runtime).
- **Database** — Cloudflare **D1** (SQLite). Schema: [`schema.sql`](schema.sql).
- **File storage** — Cloudflare **R2** for material uploads.
- **AI Copilot** — Qwen via the DashScope OpenAI-compatible endpoint. AI surfaces (extract-capabilities, match-roles, role-prefill, rewrite, summary, copilot) all return `{ ok: false, reason: 'no_api_key' }` when `QWEN_API_KEY` (or `DASHSCOPE_API_KEY`) isn't set.
- **Auth** — JWT in an HttpOnly `rm_token` cookie. PBKDF2 password hashes (100k iterations, SHA-256).

Mirrors the deploy + branch layout used in the `aselo` SaaS sister project.

## Project layout

```
RoleMaster/
├── functions/                     Cloudflare Pages Functions (the API)
│   └── api/
│       ├── _middleware.js         JWT auth gate, public-route allowlist
│       ├── _helpers.js            JSON, cookies, JWT (HS256), PBKDF2, IDs
│       ├── _fields-template.js    Default form field schema for new submissions
│       ├── health.js              GET /api/health
│       ├── auth/
│       │   ├── register.js        POST   /api/auth/register
│       │   ├── login.js           POST   /api/auth/login
│       │   ├── logout.js          POST   /api/auth/logout
│       │   └── me.js              GET    /api/auth/me
│       ├── catalog/
│       │   ├── index.js           GET    /api/catalog
│       │   └── [id].js            GET    /api/catalog/:id
│       ├── submissions/
│       │   ├── index.js           GET, POST /api/submissions
│       │   └── [id]/
│       │       ├── index.js       GET    /api/submissions/:id
│       │       ├── submit.js      POST   /api/submissions/:id/submit
│       │       ├── fields.js      PATCH  /api/submissions/:id/fields  (bulk)
│       │       ├── fields/[fid].js PATCH /api/submissions/:id/fields/:fid
│       │       ├── files.js       GET, POST /api/submissions/:id/files (R2)
│       │       └── copilot.js     GET, POST /api/submissions/:id/copilot
│       └── curator/submissions/[id]/
│           ├── decision.js        POST   /api/curator/submissions/:id/decision
│           └── publish.js         POST   /api/curator/submissions/:id/publish
│
├── app/                           React frontend (Vite)
│   ├── src/{App,api,auth,chrome,i18n,styles,...}.jsx
│   └── src/screens/{landing,portal-login,supplier-home,onboard,form,other,workbench,sales}.jsx
│
├── schema.sql                     D1 schema
├── seed.sql                       Preset accounts (curator + sales)
├── wrangler.toml                  Prod Pages config (D1 + R2 bindings)
├── wrangler.uat.toml              UAT Pages config (separate D1 + R2)
├── scripts/
│   ├── deploy-uat.sh              Atomic toml-swap deploy to rolemaster-uat.pages.dev
│   └── deploy-prod.sh             Clean-tree deploy to rolemaster.pages.dev
└── handoff/                       Original Claude Design HTML/JSX prototype (reference)
```

## Run locally

```bash
# 1. Install everything
npm run install:all

# 2. Apply schema + seed to LOCAL D1 (one-time, simulated by Miniflare)
npm run schema:local
npm run seed:local

# 3. Set a JWT secret (and optionally a Qwen key) for local dev
cat > .dev.vars <<EOF
JWT_SECRET="local-dev-only-change-me"
# QWEN_API_KEY="sk-..."
EOF

# 4. Build the SPA once (so dist/ exists for wrangler to serve)
npm run build

# 5. Start both servers concurrently (Vite on 5173, wrangler on 8788; vite proxies /api)
npm run dev
```

Open `http://localhost:5173/`.

### Preset accounts (password: `demo`)

| Role | Email |
|---|---|
| Curator | `grace@rolemaster.io` |
| Sales | `sales@rolemaster.io` |

Suppliers self-register at `/supplier/register`.

## Deploy to Cloudflare Pages

This is a one-time setup. Subsequent deploys are a single command.

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

A browser opens — approve the OAuth grant.

### 2. Create the D1 database

```bash
npx wrangler d1 create rolemaster-db
```

Output gives you a `database_id`. Paste it into [wrangler.toml](wrangler.toml) under `[[d1_databases]]` (replace `REPLACE_ME_AFTER_wrangler_d1_create`).

Repeat for UAT if you want a separate environment:

```bash
npx wrangler d1 create rolemaster-db-uat
# paste the new id into wrangler.uat.toml
```

### 3. Create the R2 bucket

```bash
npx wrangler r2 bucket create rolemaster-files
# UAT (optional)
npx wrangler r2 bucket create rolemaster-files-uat
```

### 4. Apply schema + seed to remote D1

```bash
npm run schema   # applies schema.sql to remote rolemaster-db
npm run seed     # creates the curator + sales preset accounts
```

### 5. Create the Pages project

```bash
npx wrangler pages project create rolemaster --production-branch=main
# UAT (optional)
npx wrangler pages project create rolemaster-uat --production-branch=main
```

### 6. Set secrets

```bash
# Generate a strong random JWT secret
npx wrangler pages secret put JWT_SECRET --project-name=rolemaster
# (paste a 32+ char random string — generate with `openssl rand -hex 32`)

# Required — enables every AI surface (extract / match / prefill / copilot / summary)
npx wrangler pages secret put QWEN_API_KEY --project-name=rolemaster
# (paste your DashScope API key)
```

### 7. Deploy

```bash
npm run deploy:prod      # builds SPA, deploys to rolemaster.pages.dev
# or
npm run deploy:uat       # to rolemaster-uat.pages.dev (uses the toml-swap pattern)
```

Live at `https://rolemaster.pages.dev` (and `https://rolemaster-uat.pages.dev` for UAT).

### Per-deploy commands after the one-time setup

```bash
git push                    # sync code
npm run deploy:prod         # ship to prod
npm run deploy:uat          # ship to UAT
```

## Branch model (mirrors aselo)

| Branch | Purpose |
|---|---|
| `main` | Production. Deploy from here. |
| `uat` | UAT / pre-prod testing. |
| `feature/*` | New features. Merge into `uat` first. |
| `hotfix/*` | Urgent prod fixes. Branch from `main`. |

Default: ship features to UAT first; promote to `main` only after the user signs off.

## End-to-end flow

1. Visit `/` → click the supplier tile
2. Register a new supplier at `/supplier/register`
3. Land on `/supplier` (empty dashboard) → "+ New submission"
4. Upload a file (R2) → identify products → form auto-creates a real submission
5. Type freeform context to the Copilot — it extracts fields and persists them
6. Submit → confirm → thanks. Submission status `draft` → `new`.
7. Sign out, sign in as `grace@rolemaster.io` at `/curator`
8. Queue shows the new submission. Click in, tick checks, click "Approve and publish"
9. A RolePack is created in D1; submission marked `published`
10. Sign out, sign in as `sales@rolemaster.io` at `/sales`
11. Catalog now shows the new RolePack

## License

Private.
