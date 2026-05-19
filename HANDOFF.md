# RoleMaster — handoff guide

Everything a new developer needs to take over `airolemaster.com` end-to-end. Read top-to-bottom on first pass; sections 1–5 are the must-do transfer steps, sections 6–9 are reference once they have access.

---

## 1. Where the code lives

| Asset | Location | Notes |
|---|---|---|
| **Local working copy** (current dev) | `C:\AI\RoleMaster` (Windows) | Single working tree on `main`; no other branches in active use. |
| **GitHub remote** | `https://github.com/rcht-ai/rolemaster` | Default branch `main`. Every commit since project start. |
| **Production site** | `https://www.airolemaster.com` (DNS) → `rolemaster.pages.dev` (Cloudflare Pages) | Apex `airolemaster.com` + `www` both resolve. |
| **Preview deploys** | `https://<sha>.rolemaster.pages.dev` | Cloudflare creates one per `wrangler pages deploy` run. |
| **Database** | Cloudflare D1, name `rolemaster-db`, id `aeb08d61-8d79-43e7-8d1c-9aed581e1c62` | SQLite-flavoured. Bound as `DB` in functions. |
| **Object storage** | Cloudflare R2, bucket `rolemaster-files` | Bound as `R2`. Used for uploaded partner files (PDFs, images). |
| **AI provider** | DashScope (Aliyun) running Qwen models | API key lives in Cloudflare Pages secrets — see §4. |
| **Original logo artwork** | `C:\AI\RoleMaster\logos\` on the dev machine | The four PNGs. **Not in git** (only the cropped `app/public/logos/*.png` are). Get from old dev or re-export from designer. |

Repo layout overview:

```
C:\AI\RoleMaster\
├── app/                          # Vite + React 18 frontend (SPA)
│   ├── public/logos/             # Tight-cropped PNG logos served at /logos/*
│   ├── src/
│   │   ├── App.jsx               # Router + AppShell (lang, tweaks, theme)
│   │   ├── api.js                # fetch wrappers (auth, curator, sales, taxonomy)
│   │   ├── chrome.jsx            # AppHeader / PlatformHeader (curator+partner shell)
│   │   ├── i18n.js               # zh/en strings (s1_*…s11_*, nav_*, landing_*)
│   │   ├── taxonomy-fallback.js  # Static industries + departments (resilience)
│   │   ├── tweaks.jsx            # Theme tweaker panel (density/warmth/round)
│   │   ├── styles.css            # ~5000 lines — global + .lr-* marketing + portals
│   │   └── screens/
│   │       ├── landing/          # Marketing landing modules (Hero, Catalog, Capabilities, Partner, Roadmap, Contact, SiteHeader, SiteFooter, RcPopover)
│   │       ├── landing.jsx       # /
│   │       ├── rolepack-catalog.jsx  # /rolepacks
│   │       ├── portal-login.jsx  # /partners + /curators + /advisors login card
│   │       ├── supplier-home.jsx # /partners dashboard
│   │       ├── curator-library.jsx   # /curators/library
│   │       ├── other.jsx         # Curator queue + workbench + publish screens
│   │       ├── suppliers-mgmt.jsx, users-mgmt.jsx
│   │       ├── legal.jsx         # /legal/terms, /legal/privacy
│   │       └── v2/               # Partner intake flow (register, onboard, capabilities, roles, role-details, review, done, company-setup, service-pricing, sales-library)
│   ├── index.html
│   └── package.json              # only react + react-dom + react-router + vite + pdfjs-dist
├── functions/                    # Cloudflare Pages Functions (server)
│   └── api/
│       ├── _helpers.js, _middleware.js, _fields-template.js
│       ├── _lib/
│       │   ├── industry-remap.js     # Maps legacy/leaf industries → 13 cat_* parents
│       │   └── ai/                   # Qwen client + prompts + parsing
│       │       ├── client.js, parse.js, logging.js, intake-files.js
│       │       └── prompts/copilot.js, role-prefill.js, match-roles.js
│       ├── auth/login.js, register.js, logout.js, me/index.js, me/language.js
│       ├── intakes/[id]/...          # Partner-side intake + capabilities + rolepacks
│       ├── curator/                  # Curator endpoints (intakes, rolepacks/feature, /reorder, /industries, suppliers, users)
│       ├── public/rolepacks.js       # Public /rolepacks catalogue API
│       ├── sales/                    # Sales/advisor endpoints
│       ├── taxonomy/industries/index.js, [id].js
│       ├── admin/seed-3-suppliers.js
│       └── health.js
├── scripts/
│   ├── crop-logos.js                 # sharp-based bbox cropper for the logo PNGs
│   └── migrate-v2-taxonomy-hierarchy.sql  # Industries + departments seed
├── marketing-redesign/               # PATCH-1 through PATCH-16 markdown briefs (history of every UI change)
├── schema.sql                        # D1 schema (full)
├── seed.sql, seed-demo.sql           # Optional dev seeds
├── wrangler.toml                     # Cloudflare Pages binding config (DB + R2 + secrets list)
├── wrangler.uat.toml                 # UAT subdomain config (documented but never executed)
├── CLAUDE.md                         # Conventions for AI-assisted dev (read this if you use Claude Code)
├── PLAN.md                           # Earlier roadmap (mostly historical)
├── README.md                         # Per-folder readmes scattered
└── SUPPLIER_PLATFORM_HANDOVER.md     # Earlier handover for the supplier flow specifically
```

---

## 2. Required accounts the new owner needs

Make sure the new dev has, or gets, access to all of these. **The site won't deploy or function without them.**

1. **GitHub** — collaborator on `rcht-ai/rolemaster`, or transfer ownership.
2. **Cloudflare** — Pages project `rolemaster`, D1 database `rolemaster-db`, R2 bucket `rolemaster-files`. The account that owns the Pages project also owns the D1 + R2 bindings. Either:
   - Add the new dev to the existing Cloudflare account as a member with appropriate permissions, OR
   - Transfer the entire Cloudflare account to them (cleanest).
3. **Domain registrar** — wherever `airolemaster.com` is registered (check Cloudflare → DNS → `airolemaster.com` zone for the nameserver records; if Cloudflare is the registrar, transfer there). Without this they can't repoint DNS if anything breaks.
4. **DashScope / Aliyun** — the AI key. Either share the existing `QWEN_API_KEY` value or have them register their own DashScope account, generate a key, and you swap the Cloudflare secret. Their dashboard lives at `https://dashscope.console.aliyun.com/` (China region) or the intl variant.
5. **Local machine** — give them this repo's working copy or re-clone fresh. Node ≥ 18, git, and Cloudflare Wrangler CLI required (see §3).

---

## 3. Step-by-step transfer

### Step 1 — Confirm git is clean and pushed

```bash
cd C:/AI/RoleMaster
git status                # working tree should be clean
git log --oneline -5      # last 5 commits
git rev-parse HEAD        # local HEAD
git rev-parse origin/main # remote HEAD
# Both rev-parse should print the same SHA. If not, push: git push origin main
```

### Step 2 — Hand over the GitHub repo

Either:

**Option A (cleanest): transfer ownership**

`Repo → Settings → Danger Zone → Transfer ownership` to the new account. The new owner accepts the transfer email; the repo URL becomes `github.com/<new-owner>/rolemaster`. Update `wrangler.toml` and any docs that reference the URL.

**Option B: add as collaborator**

`Repo → Settings → Collaborators → Add people` with admin permission.

### Step 3 — Hand over the Cloudflare account

The Pages project `rolemaster` carries the D1 + R2 bindings. Three options, ordered by preference:

**Option A — Account transfer** (best for solo founder handoffs).
- Cloudflare doesn't support direct account transfer; instead change the root email + password on the account so the new owner controls it. Verify they have 2FA set up before you log out.

**Option B — Add member to existing account.**
- `Cloudflare dash → Account → Members → Invite member` with Admin role. The new dev can manage Pages, D1, R2, secrets, DNS.

**Option C — Migrate to a new Cloudflare account.**
- Heavier. Re-create D1 db, R2 bucket, Pages project on their account. Export the D1 data via `wrangler d1 export rolemaster-db --remote --output=backup.sql`, import to the new D1 with `wrangler d1 execute <new-db-name> --remote --file=backup.sql`. Re-create R2 contents (one-time `rclone` sync or manual). Update `wrangler.toml` with the new `database_id`. Point DNS at the new Pages project.

### Step 4 — Hand over the domain

`airolemaster.com` resolves to Cloudflare Pages. Confirm whether the domain is registered AT Cloudflare or elsewhere:

- Cloudflare dash → Domain Registration. If it's there, transfer to the new owner's Cloudflare account (Domain → Configuration → Move).
- If it's at another registrar (GoDaddy, Namecheap, etc.), do a standard ICANN domain transfer to the new owner's registrar account, then make sure the nameservers still point to Cloudflare's nameservers (or migrate DNS too).

### Step 5 — Hand over the AI key

The `QWEN_API_KEY` (DashScope) is stored as a Cloudflare Pages secret on the `rolemaster` project. Either:

- Share the existing key value (least friction), OR
- Have the new dev create their own DashScope account + key, then on their machine: `npx wrangler pages secret put QWEN_API_KEY --project-name=rolemaster` and paste their key.

Other secrets configured the same way (see `wrangler.toml` comments for the full list):

```
JWT_SECRET           # session-signing JWT secret (random string)
QWEN_API_KEY         # DashScope API key (alias: DASHSCOPE_API_KEY)
QWEN_MODEL           # optional, default qwen-plus
QWEN_BASE_URL        # optional, default dashscope-intl
```

Verify with `npx wrangler pages secret list --project-name=rolemaster` after the new dev is logged in.

### Step 6 — New dev: clone + set up local environment

```bash
# Prereqs: Node ≥ 18, git, npm
git clone https://github.com/rcht-ai/rolemaster.git
cd rolemaster

# Install frontend deps
cd app
npm install
cd ..

# Install Wrangler globally (or use npx wrangler everywhere)
npm install -g wrangler

# Authenticate Wrangler against the Cloudflare account
wrangler login
# Browser pops up, log in with the new owner's Cloudflare credentials
```

### Step 7 — Run locally

```bash
# Terminal 1: Vite dev server (frontend)
cd app
npm run dev
# → http://localhost:5173

# Terminal 2: Pages Functions + API + D1 (backend)
cd ..
npx wrangler pages dev app/dist --d1=DB --r2=R2
# → http://localhost:8788
# Note: Vite proxies /api to :8788 (see app/vite.config.js)
```

For a fully local D1 you'll need to seed it once:

```bash
npx wrangler d1 execute rolemaster-db --local --file=schema.sql
npx wrangler d1 execute rolemaster-db --local --file=seed.sql       # optional dev data
npx wrangler d1 execute rolemaster-db --local --file=seed-demo.sql  # optional richer demo data
```

### Step 8 — First deploy (sanity check)

After local setup works, do a trivial change (e.g. fix a typo) and deploy to prove the pipeline is healthy on the new owner's machine.

```bash
cd app
npm run build         # produces ../dist
cd ..
git add -A
git commit -m "Handoff sanity deploy"
git push origin main
npx wrangler pages deploy dist --project-name=rolemaster --branch=main --commit-dirty=true
```

If the deploy succeeds and the preview URL renders, the handoff is complete on the technical side. **Don't deploy ahead of `origin/main`** — see CLAUDE.md for why (prod bundle must equal a SHA on origin/main).

---

## 4. Architecture summary (so the new dev can debug quickly)

- **Stack:** React 18 + Vite SPA, Cloudflare Pages + Pages Functions (Node.js compat), D1 (SQLite), R2 (object storage), Qwen via DashScope for every AI surface.
- **Routing:** `react-router-dom` in `app/src/App.jsx`. The marketing landing is at `/`, `/cn`, `/en`. `/rolepacks` is the public catalogue. `/partners`, `/curators`, `/advisors` are the three role portals (URLs are user-facing; JWT roles internally are still `supplier` / `curator` / `sales`).
- **Auth:** JWT in an httpOnly cookie signed with `JWT_SECRET`. The functions middleware (`functions/api/_middleware.js`) decodes it and attaches `context.data.user`. Frontend uses `auth.login()` / `auth.me()` / `auth.logout()` from `app/src/api.js`.
- **AI surfaces:** every AI call goes through `functions/api/_lib/ai/client.js` → DashScope OpenAI-compatible endpoint. Each surface has a prompt module under `functions/api/_lib/ai/prompts/`. Outputs are strict JSON validated against a schema (`parse.js`).
- **Industries:** canonical set is 13 parent categories (`cat_finance` … `cat_other`) defined in `scripts/migrate-v2-taxonomy-hierarchy.sql` and mirrored in `app/src/taxonomy-fallback.js`. Read-time bucketing via `functions/api/_lib/industry-remap.js` cleans up legacy leaves at the public API edge.
- **Languages:** `lang` state in `AppShell`, persisted to `localStorage.rm_lang` and `users.language` (server). i18n strings in `app/src/i18n.js`, namespaced by surface (`s1_*…s11_*`, `landing_*`, `nav_*`).
- **Theme:** Cloudflare doesn't see this — all CSS variables live in `app/src/styles.css` `:root` and `.lr-root`. The `Tweaks` panel (top-right) flips `density-*`, `warm-*`, `round-*` body classes and `--plat-*` colors at runtime.

---

## 5. Deploy workflow (the rule, in one paragraph)

**`main` is the production branch.** Solo work skips PR ceremony but **must** push to `origin/main` before running `wrangler pages deploy dist --project-name=rolemaster --branch=main`. The bundle on prod must equal a SHA reachable on `origin/main`. Never deploy ahead of `origin/main`. Never run `wrangler d1 execute --remote` from a UI lane without a coordinated schema-change commit. Never commit `.dev.vars`, `.wrangler/`, `dist/`, or `node_modules/`.

---

## 6. Notable conventions / gotchas (read before changing things)

- **CLAUDE.md** at the repo root has the AI-assisted dev rules (when this project was multi-lane). Multi-lane is over — one developer owns the whole stack now.
- **`marketing-redesign/PATCH-1.md` through `PATCH-16.md`** is the entire history of UI patches applied. If something looks weird, search those files for the intent.
- **Logo wordmark must match menu text size.** Standing rule, has been re-broken multiple times. The cropped `app/public/logos/rm-light-h.png` (1219×258) has wordmark cap at ~50% of total height, so `.lr-logo-img { height: 32px }` desktop puts the wordmark at the same eye-weight as the 14px nav links. Curator app-header uses `height: 30px`. Don't bump bigger without an explicit ask.
- **Industries are normalized to the 13 `cat_*` parents** end-to-end. The AI prompt (`match-roles.js`), the partner picker (`roles.jsx`), the partner save endpoint (`intakes/[id]/rolepacks/[rpId]/index.js`), and the curator library inline editor all expect this. Legacy `custom:xxx` or leaf strings are remapped on save and at read-time.
- **`/rolepacks` and `/curators/library` share a sticky `.lr-filter-stack`** that wraps chip-bar + search-form. Both surfaces also share the `RcPopover` component for capability-detail popups.
- **PNGs in `app/public/logos/` are tight-cropped.** Re-cropping is automated by `node scripts/crop-logos.js` — drop new artwork in the same path and re-run.
- **Auth login currently returns HTTP 500 for the seeded `curator@demo` and `grace@rolemaster.io` accounts** (known prod bug at the time of writing). Fresh `register → login` round-trips work. Don't try to "fix" it from a UI lane.
- **Sales portal (`/advisors`) is partially scaffolded** but unused so far. Don't be surprised by empty UIs there.
- **`UAT` subdomain is documented in `wrangler.uat.toml` but never deployed.** Setup steps are in that file's comments.

---

## 7. Common debug recipes

```bash
# Look at the last 10 prod deploys
npx wrangler pages deployment list --project-name=rolemaster | head -25

# Query the live database
npx wrangler d1 execute rolemaster-db --remote --command="SELECT id, status, updated_at FROM intakes ORDER BY updated_at DESC LIMIT 10"

# Read live API output
curl -s https://www.airolemaster.com/api/public/rolepacks | head -50

# Roll back to a previous deploy
npx wrangler pages deployment list --project-name=rolemaster        # find the target SHA
# In Cloudflare dash → Pages → rolemaster → Deployments → "..." → Rollback

# Force rebuild from origin/main (don't push ahead of remote)
git pull --rebase origin main
cd app && npm run build && cd ..
npx wrangler pages deploy dist --project-name=rolemaster --branch=main --commit-dirty=true
```

---

## 8. Outstanding / known issues at handoff

- The seeded curator login (`curator@demo`) returns HTTP 500. Mitigation: register a fresh curator account via `/api/auth/register` and grant the curator role with a manual D1 update.
- Sales portal (`/advisors`) is stub-shaped — the `sales-library.jsx` screen exists but isn't fully wired.
- The legacy `custom:xxx` industry strings in older rolepack rows will normalize to `cat_*` next time anyone edits those rolepacks (via the partner workbench or the curator inline industry editor). No batch migration was run.
- `.lr-logo-mark` and `.app-header .brand-mark` CSS rules are dead code (replaced by the real PNG lockup) but kept in `styles.css` for the next sweep.

---

## 9. Useful URLs / dashboards

| Resource | URL |
|---|---|
| Live site | https://www.airolemaster.com |
| GitHub repo | https://github.com/rcht-ai/rolemaster |
| Cloudflare Pages dashboard | https://dash.cloudflare.com → Workers & Pages → `rolemaster` |
| Cloudflare D1 | https://dash.cloudflare.com → Workers & Pages → D1 → `rolemaster-db` |
| Cloudflare R2 | https://dash.cloudflare.com → R2 → `rolemaster-files` |
| DashScope console | https://dashscope.console.aliyun.com/ (or intl) |
| Wrangler docs | https://developers.cloudflare.com/workers/wrangler/ |
| Vite docs | https://vitejs.dev/ |

---

## 10. Final checklist (before you sign off the handoff)

- [ ] GitHub repo transferred or new dev added as admin collaborator
- [ ] Cloudflare account transferred / new dev added as member
- [ ] DNS for `airolemaster.com` still resolves (no nameserver churn during transfer)
- [ ] `QWEN_API_KEY` + `JWT_SECRET` secrets accessible to new dev
- [ ] New dev has cloned the repo, run `npm install`, run `wrangler login`
- [ ] New dev has run `npm run dev` and `wrangler pages dev` locally without errors
- [ ] New dev has done one successful `wrangler pages deploy` to prod
- [ ] New dev has CLAUDE.md and this HANDOFF.md bookmarked
- [ ] You've forwarded any pending designer / vendor / customer conversations

If all ten boxes are ticked, you're done. Best of luck to whoever's taking over.
