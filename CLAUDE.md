# RoleMaster — agent guide

This repo is being built across **multiple concurrent Claude conversations**, one per portal page (curator, supplier, sales). The rules below keep those sessions from clobbering each other's work. Read this file in full before touching anything.

## The one rule

**`main` is a merge artifact, never a working surface.**

Every conversation works on its own branch in its own worktree, deploys to its own Cloudflare Pages preview alias, and never runs `wrangler pages deploy --branch=main` itself. Prod (`rolemaster.pages.dev`) is updated by the human, manually, after branches merge into `main`.

If the user asks you to "deploy to prod" while you're on a feature branch and there's parallel work in another session, **stop and warn first** — the SPA is one bundle, your deploy will overwrite the other session's routes. Ask for one of:
1. The other branch be merged to `main` first, then rebase + deploy from `main`.
2. Hand over the other branch so you can merge locally, then deploy.
3. Leave prod alone, keep the work on the preview URL.

## Per-conversation setup

Each conversation gets a worktree + branch + preview alias. Spin up a new lane with:

```bash
git worktree add .claude/worktrees/<lane> -b <lane> origin/main
```

Deploy with:

```bash
npx wrangler pages deploy dist --project-name=rolemaster --branch=<lane> --commit-dirty=true
```

That produces `https://<lane>.rolemaster.pages.dev`. Always share the preview URL when you finish a deploy (per the user's standing preference).

Current lanes:

| Lane (branch) | Owns | Preview URL |
|---|---|---|
| `claude/pedantic-swartz-f1c35c` (or successor `curator-redesign`) | curator portal — `/curator`, `/curator/workbench/:id`, `/curator/publish/:id` | `curator-prototype.rolemaster.pages.dev` |
| `supplier-v2` | supplier portal — `/supplier`, registration, intake, form, confirm | `supplier-v2.rolemaster.pages.dev` |
| `sales-*` (when needed) | sales portal — `/sales`, `/sales/rolepack/:id` | `sales-*.rolemaster.pages.dev` |

## File ownership

Stay in your lane. The table below is the source of truth — if it's not in your column, don't edit it without flagging the user first.

### Curator lane owns
- `app/src/screens/other.jsx` — `ScreenQueue`, `ScreenConfirm`-passthrough on the curator side, `ScreenPublish`
- `app/src/screens/workbench.jsx`
- `app/src/styles.css` — only the `Curator inbox …` block (search for the comment header)
- `app/src/i18n.js` — `s6_*`, `s7_*`, `s8_*` keys
- `functions/api/curator/**`
- `functions/api/submissions/[id]/copilot.js` (curator-side AI assistance)

### Supplier lane owns
- `app/src/screens/supplier-home.jsx`, `onboard.jsx`, `form.jsx`, `landing.jsx`
- `app/src/screens/portal-login.jsx`
- `app/src/styles.css` — supplier/landing/form blocks; v2 design system tokens are supplier-driven for now
- `app/src/i18n.js` — `s1_*` through `s5_*` keys, plus shared `nav_*`, `status_*`, `copilot_*`, `save_state_*`, `progress_*`, `submit_*`, `add_*`, `sec*`
- `functions/api/auth/**`, `functions/api/submissions/**` (except curator copilot above)

### Sales lane owns
- `app/src/screens/sales.jsx`
- `app/src/styles.css` — sales/catalog/rolepack blocks
- `app/src/i18n.js` — `s9_*`, `s10_*`, `s11_*`, `gen_*` keys
- `functions/api/catalog/**`

### Shared — touch carefully, commit immediately, tell the other lanes to rebase
- `app/src/App.jsx`
- `app/src/chrome.jsx` (BrandMark, PlatformHeader, AppHeader, CuratorHeader, ProcessStepper, getPlatformSteps, SCREENS)
- `app/src/styles.css` — design tokens at the top (`:root`, theme blocks, `--plat-*`, density/roundness/warmth, `.app-header`, `.btn*`, `.proc-stepper`, `.screen-picker`, `.bubble`, generic statuses)
- `app/src/auth.jsx`, `app/src/api.js`, `app/src/main.jsx`, `app/src/data.js`, `app/src/tweaks.jsx`
- `app/index.html`
- `functions/api/_middleware.js`, `_helpers.js`, `_fields-template.js`, `health.js`
- `schema.sql`, `seed.sql`, `seed-demo.sql`, `wrangler.toml`, `wrangler.uat.toml`, `package.json`, `vite.config.js`, `scripts/**`

When you must edit a shared file:
1. Make the change minimal and additive where possible.
2. Commit it as its own commit (not bundled with lane-specific work).
3. Push, and tell the user "I touched <file> for X; the other lane should `git fetch && git rebase origin/main`."

## i18n keys are namespaced — keep it that way

Keys for each lane stay in their numbered range (`s1_…s5` supplier, `s6_…s8` curator, `s9_…s11` sales). If you need a genuinely shared string, prefix with the surface (e.g., `nav_*`, `copilot_*`) and mention it in your commit message so other lanes notice.

## CSS is co-located but section-isolated

`app/src/styles.css` is one file, partitioned by section comments. Each lane edits *only* inside its own section. Do not refactor design tokens (`:root` block) without flagging — those changes affect every page.

## Auth + API notes

- Live `/api/auth/login` currently returns HTTP 500 for the seeded `curator@demo` and `grace@rolemaster.io` accounts. Fresh `/api/auth/register` → login round-trips work fine. Treat this as a known prod bug; don't try to "fix" it from a UI lane.
- For prototypes that need to render without sign-in, use a `?preview=1` URL flag handled in `App.jsx`'s landing component (already wired for `/curator`). Add an equivalent for your portal if you need one — additive only, default behavior unchanged.

## Demo data fallback

If a screen depends on `subs.list()`, `catalog.list()`, etc., wrap the call so it falls back to static demo data from `app/src/data.js` on error. The prototype must keep rendering even when the API is unreachable.

## Tweaks panel must keep working

Every screen must respect `density-*`, `round-*`, `warm-*` body classes and the `--plat-*` color variables. Don't hardcode colors that the Tweaks panel is supposed to drive.

## Don't

- Don't add comments that just narrate code or mention the current task ("// added for the curator redesign"). One-line *why* comments only when non-obvious.
- Don't commit `.dev.vars`, `.wrangler/`, `dist/`, or `node_modules/`.
- Don't run destructive git commands (`reset --hard`, `push --force`, branch deletes) without explicit user instruction.
- Don't run remote D1 writes (`wrangler d1 execute --remote`) from a UI lane. Schema/seed changes belong in a coordinated commit reviewed by the user.
- Don't deploy to `--branch=main` from inside a feature lane. Ever.

## Quick checklist before you finish a turn

- [ ] Changes scoped to your lane's owned files (or a justified shared-file commit).
- [ ] Build passes (`npm run build` from `app/`).
- [ ] If you deployed: shared the preview URL.
- [ ] If you touched a shared file: said so explicitly in the chat so the user can relay it.
