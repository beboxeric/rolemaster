# RoleMaster Platform — Handover Document

> Read this first if you've never touched this codebase. It's the single source of truth for what the platform does, why each screen exists, what the data model looks like, where things live, and how to deploy without breaking it.

> **2026-05-03 update:** This used to be supplier-only. The platform now has three audiences with consolidated single-conversation ownership: **Capability Partner** (vendor), **Curator** (internal), and **Solution Advisor** (sales). Internal JWT roles + DB columns + `/api/...` endpoints stay `supplier` / `curator` / `sales` — only user-facing labels and frontend URLs use the new names.

## URL + label table (live)

| Side | Chinese | English | URL | Internal role |
|---|---|---|---|---|
| Marketing | — | — | https://www.airolemaster.com/ | (public) |
| Vendor | 能力伙伴 | Capability Partner | https://www.airolemaster.com/partners | `supplier` |
| Internal team | 策展人 | Curator | https://www.airolemaster.com/curators | `curator` |
| Sales | 方案顾问 | Solution Advisor | https://www.airolemaster.com/advisors | `sales` |

## Demo accounts (created 2026-05-03)

For local prototype testing without going through registration:

| Role | Email | Password | URL |
|---|---|---|---|
| Capability Partner | (register fresh — login works) | — | /partners |
| Curator | `demo-curator@airolemaster.com` | `curator1234` | /curators |
| Solution Advisor | `demo-advisor@airolemaster.com` | `advisor1234` | /advisors |

Curator + Advisor accounts were created via a one-shot seed endpoint (now deleted). The supplier-side `/api/auth/login` returns 500 for some pre-seeded legacy accounts (known bug, separate fix); fresh `/api/auth/register` → `/api/auth/login` works for new partner accounts.

## Apex → www redirect

`https://airolemaster.com` 301-redirects to `https://www.airolemaster.com` via a Cloudflare Redirect Rule on the `airolemaster.com` zone (Rules → Redirect Rules → "Apex to www"). Only the `www` URL is canonical.

---

## 0. Critical operational rules

### Deploy

```bash
cd C:/AI/RoleMaster
npm --prefix app run build           # outputs to dist/ at PROJECT ROOT (not app/dist!)
npx wrangler pages deploy dist --project-name=rolemaster --branch=main --commit-dirty=true
```

- Vite is configured (`app/vite.config.js`) to write to `../dist/` — i.e. project root `dist/`. There is also a stale `app/dist/` from a long-ago build. **NEVER deploy `app/dist/`** — you'll deploy a 3-day-old build and the site will look "broken" while the canonical URL drifts further from your local code.
- After deploy, sanity-check the chunk hash:
  ```bash
  ls -la C:/AI/RoleMaster/dist/assets/    # must match what `npm run build` printed
  ```
  If `wrangler` says `Uploaded 0 files (3 already uploaded)` after a build that produced new files → wrong directory.

### Database (D1)

- Binding: `DB`, project `rolemaster-db`, ID `aeb08d61-8d79-43e7-8d1c-9aed581e1c62`.
- Schema lives at `schema.sql`. Migrations are individual files in `scripts/migrate-*.sql`.
- The CLI account token currently lacks D1 permissions, so we can't run `wrangler d1 execute --remote` from this environment. Two workarounds in use:
  1. **Auto-migrations in handlers** — see `functions/api/suppliers/me/company-info.js` `ensureContactColumns()`. Idempotent `ALTER TABLE … ADD COLUMN` wrapped in try/catch runs on every request; near-zero cost after the first run. Use this for column additions.
  2. **Manual via dashboard** — Cloudflare Pages dashboard → D1 → query console.

### R2 storage

- Binding: `R2`, bucket `rolemaster-files`. Used for supplier file uploads (intake materials, API docs).

### Secrets (set via `wrangler pages secret put`)

- `JWT_SECRET` — required, signs session JWTs.
- `QWEN_API_KEY` (or `DASHSCOPE_API_KEY`) — required for AI surfaces (capability extraction, role matching, role prefill, copilot, summary, rewrite, finalize). Without it, AI endpoints return `{ ok: false, reason: 'no_api_key' }`.

---

## 1. Product overview

RoleMaster is a B2B marketplace where AI products are packaged as **岗位 (Roles)** — bundles of capabilities + a job description that an enterprise customer can drop into their workforce. Three audiences:

- **Supplier** (green theme — `--plat-supplier #4DAC77`) — uploads product materials, AI extracts capabilities, AI proposes roles, supplier confirms + fills questionnaire, submits for review.
- **Curator** (purple theme — `--plat-curator #8B5CF6`) — reviews supplier submissions, polishes them, publishes to sales catalog.
- **Sales** (blue theme — `--plat-sales #3B82F6`) — browses published RolePacks, exports pitches/decks for clients.

This document focuses on the **supplier** flow. Curator + sales are documented separately in their own files.

---

## 2. Supplier flow — the 8 steps

Every supplier action is a step in an **intake** (one row in `intakes` table). The 8-step stepper is rendered in `chrome.jsx` and visible at the top of each workflow page.

| # | Stepper label | Route | Screen | Backend writes |
|---|---|---|---|---|
| 1 | 概览 / Overview | `/supplier/register` then `/supplier/company-setup` | `register.jsx` + `company-setup.jsx` | `suppliers`, `supplier_company_info` |
| 2 | 产品资料 / Product Materials | `/supplier/onboard` or `/supplier/onboard/:id` | `onboard.jsx` | `intakes`, `intake_files` (R2) |
| 3 | 能力梳理 / Capabilities | `/supplier/intake/:id/capabilities` | `capabilities.jsx` | `capabilities_v2` |
| 4 | 岗位匹配 / Roles | `/supplier/intake/:id/roles` | `roles.jsx` | `rolepacks_v2` |
| 5 | 完善岗位 / Role Details | `/supplier/intake/:id/role/:rpId/details` | `role-details.jsx` | `rolepacks_v2.questionnaire_json` |
| 6 | 服务与价格 / Service & Pricing | `/supplier/intake/:id/service-pricing` | `service-pricing.jsx` | `intakes.service_pricing_json` |
| 7 | 最终确认 / Final review | `/supplier/intake/:id/review` | `review.jsx` | `intakes.status='submitted'`, `rolepacks_v2.status='submitted'` |
| 8 | 完成 / Done | `/supplier/intake/:id/done` | `done.jsx` | (read-only progress) |

The stepper is provided by `StepperContext` in `App.jsx` — `chrome.jsx::AppHeader` reads the context and renders the stepper inline below the brand bar.

---

## 3. Page-by-page reference

### 3.1 Register — `app/src/screens/v2/register.jsx`

- Email + password + Terms checkbox. Soft warning if email is a free webmail (gmail/qq/outlook etc.).
- POST `/api/auth/register` → server sets `rm_token` cookie (HTTP-only JWT, signed with `JWT_SECRET`).
- On success → `/supplier/onboard` (skips company-setup if already filled).

### 3.2 Company setup — `app/src/screens/v2/company-setup.jsx`

One-time, shown after register if `company_name` is empty. Two cards:

1. **公司 / Company** — `公司名称` (required, ZH/EN), `总部` (required), `公司官网` (optional)
2. **联系人 / Contact person** — `姓名`, `手机`, `工作邮箱` (all required). `工作邮箱` auto-prefills from the supplier's registered login email.

PATCH `/api/suppliers/me/company-info` writes to `supplier_company_info`. The handler auto-creates `website`, `contact_name`, `contact_phone`, `contact_email` columns on first request via idempotent ALTER TABLE — so no manual migration is needed.

After save → `/supplier` (dashboard).

### 3.3 Supplier dashboard — `app/src/screens/supplier-home.jsx`

- Title: `我的产品入驻 / My products`
- Lede: `每款产品独立入驻。提交审阅后,审阅团队会逐一处理。`
- CTA: `+ 入驻新产品 / + Add product` (top-right green button)
- Each row: product name + status pill (`审阅中 / AI 匹配岗位 / 已发布`) + INT-XXX code + creation date + action button (`查看 →` or `继续 →`) + × delete (only when not locked)
- Left sidebar: **公司资料** card — clickable `编辑` jumps back to company-setup.

Statuses cascade from `intakes.status`: `draft` → `submitted` → `published`. Once `submitted`, the supplier can view but not edit (locked).

### 3.4 Onboard / product upload — `app/src/screens/v2/onboard.jsx`

- Big drop zone: **多文件上传** (multiple files at once, drag & drop). Files go to R2.
- Free-text product description.
- Industry hint (optional pre-tag).
- "继续" → `/supplier/intake/:id/capabilities` and triggers AI capability extraction in the background.

### 3.5 Capabilities — `app/src/screens/v2/capabilities.jsx`

- AI-loading state shows the **KnowledgeCardCarousel** (taller cards, lightbulb icon, vertically centered, 3 rotating teaching cards explaining what a "capability" is and what AI is doing).
- Once loaded:
  - Title: `请确认你产品的能力 ✦ AI 识别到 N 项能力`
  - Section head: `能力清单 N 项` (left) + `+ 添加能力` `↻ AI 重新分析` (right)
  - Each capability is a white card (`v2-input-card`):
    - Header: `RC-NN 能力 N` (small font, code first then label) + × delete on right
    - Name input (validated — red border + `⚠ 请填写能力名称` if empty)
    - Description textarea (4 rows, ≥88px)
    - Source quote (italic) — the AI's source span from the upload
- Validation: clicking "下一步" with any empty cap name shows banner + scrolls to first missing.

Backend: `POST /api/intakes/:id/extract-capabilities` (one-shot AI call), then `PATCH /api/intakes/:id/capabilities/:capId` for edits, `POST /api/intakes/:id/capabilities` for additions, `PATCH /api/intakes/:id/capabilities` with `{confirm_all: true}` to lock and continue.

### 3.6 Roles — `app/src/screens/v2/roles.jsx`

- AI-loading state (same KnowledgeCardCarousel, "roles" stage).
- Title: `请确认岗位匹配 ✦ AI 匹配到 N 个岗位`
- Section head: `匹配结果 N 岗位 · M 能力` (left) + `+ 添加岗位` `↻ AI 重新匹配` (right)
- Each role is a white card:
  - Header: `RP-NN 岗位 N` (small font) + × delete
  - Name input (validated)
  - Industry HierarchicalPicker — dropdown items are **filtered by active language** so zh users only see industries with zh labels; trigger button shows count `selected/total` (e.g. `15/54`)
  - Company size HierarchicalPicker (also count badge)
  - Department HierarchicalPicker (single-select)
  - Capability chips — multi-select; ✓ on the active ones; clicking toggles
- Validation: blocks "下一步" if any role missing name or capabilities; banner lists what's red.

Backend: `POST /api/intakes/:id/match-roles`, `PATCH /api/intakes/:id/rolepacks/:rpId`, `POST /api/intakes/:id/rolepacks`, `DELETE /api/intakes/:id/rolepacks/:rpId`.

### 3.7 Role details + Copilot — `app/src/screens/v2/role-details.jsx`

The most complex screen. Layout:

```
┌─ AppHeader (sticky top: 0) ──────────────────────────────┐
├─ Tab strip (sticky top: 60) — RP-NN 岗位 N · 名称 ──────┤
├─ White role-card header (sticky top: 105) ──────────────┤
│  RP-NN 岗位 N                                             │
│  名称  [optional status pill]                             │
│  industries · department · sizes (localized)              │
├──────────────────────────┬───────────────────────────────┤
│  Form (scrolls)          │  Copilot (sticky top: 105)    │
│  ┌─ 岗位画像 ──────┐     │  ┌─ ✦ Copilot ─────┐         │
│  │ 日常工作内容 *  │     │  │  Welcome bubble  │         │
│  │ [textarea]      │     │  │  + pill suggest  │         │
│  │ 决策者 *        │     │  │  ───── chat ───── │         │
│  │ ...             │     │  │  user msg        │         │
│  └─────────────────┘     │  │  bot reply       │         │
│  ┌─ 痛点 ──────────┐     │  │  ✓ updated pills │         │
│  │ ...             │     │  │  ↓ next-up pills │         │
│  └─────────────────┘     │  └──────────────────┘         │
│  ...                     │  [textarea + send]            │
└──────────────────────────┴───────────────────────────────┘
```

**Required-field validation**: every field except `(可选)`-flagged ones is required. Empty required fields show:
- Red `*` after the label
- `.error` modifier on `.text-input` → red border + light red bg + red focus ring
- `⚠ 此字段为必填` line below the field
- "下一步" button blocked + banner lists which roles are incomplete

**API doc upload row** (inside `部署` section):
- Single row: `[name input] [+ 上传文件]` button. Type a name, click upload, file picker opens. The typed name is applied to the first uploaded file.
- Each uploaded doc renders as a row: `[checkbox] [name (editable)] [filename mono] [×]`. Checkbox is a visual include/exclude toggle (client-side only).

**Copilot panel** — `RoleCopilot` component:
- Header: `✦ Copilot` + status (`N 项可起草` or `边聊边帮你填`)
- Welcome bubble (when no chat history): "你这个岗位还差 N 项必填. 选一个开始?" + 6 pill buttons for empty fields. Click a pill → sends a draft request to AI.
- Chat history rendered with bot bubbles and user bubbles.
- Each bot bubble shows:
  - ✓ chip rows for fields the AI just filled — clicking scrolls form to that field with a pulse highlight
  - The bot reply text (markdown: bold supported)
  - **Next-up pills** below the latest bot reply: top-4 still-empty fields as click-to-draft pills

The copilot's AI prompt lives at `functions/api/_lib/ai/prompts/copilot.js`. It enforces the **exact field_id list** (profile.daily_activities, pain.main_pain, …). If the AI returns an invalid field_id the backend silently drops it — that's why field IDs in the prompt MUST match `FIELD_LABELS` in `functions/api/intakes/[id]/rolepacks/[rpId]/copilot.js` exactly.

### 3.8 Service & pricing — `app/src/screens/v2/service-pricing.jsx`

One-time, shared across all roles in this intake.

**Service block:**
- 演示偏好 (multi-select pills + checkbox dropdown)
- 销售配合意愿 (single-select searchable picker)
- 销售辐射区域 (RegionPicker — hierarchical with native `<input type="checkbox">`, accent color = `--plat-supplier`)
- 交付范围 (multi-select, with **visible checkbox box border** — see `CheckboxBox` helper in `HierarchicalPicker.jsx`)
- 客户服务语言 (multi-select)

**Pricing block:**
- 定价模式 (required, free text)
- 成本价 (required)
- 建议零售价 (required)
- 私有化部署起价 (optional)
- 定制服务费 (optional)

Validation: "下一步" runs `requiredChecks` — if any required field is empty, shows banner with the list of missing fields in active language.

### 3.9 Final review — `app/src/screens/v2/review.jsx`

Read-only summary of everything before submit.

Layout: each section is a **white `v2-input-card`** with `Section title N` on the left + `✎ Edit` button on the right. Card border + subtle shadow.

- **产品** — name + free-text + file count.
- **能力** — collapsed by default. Each row stacks vertically: `RC-NN` (mono green) on top, `能力 N` (gray small) below. To the right of the title is a big ▶ triangle button. Click anywhere on the row → row expands and shows description (▶ rotates to ▼ on green tint background).
- **岗位** — for each role: green left border + `RP-NN 岗位 N · 名称` + meta line (industries · dept · sizes · N 能力) + two field blocks (`主要痛点`, `能力如何嵌入工作流`) shown as bold uppercase label + value, then `查看完整 →` link.
- **服务与价格** — KV grid.

Submit button: `确认无误,提交审阅 →`. POST `/api/intakes/:id/finalize` flips `intakes.status = 'submitted'` + every rolepack to `submitted`. Navigates to `/done`.

### 3.10 Done — `app/src/screens/v2/done.jsx`

Polling page. Triggers `POST /api/intakes/:id/rolepacks/:rpId/generate` for each role that doesn't yet have `generated_json` (the curator-facing AI-finalized content). Polls every 5s while generating, every 30s after.

Status pill: `审阅中` until curator publishes; `已发布` after.

---

## 4. Visual system

### 4.1 Colors

```css
/* Tweak defaults — set in App.jsx, persisted in localStorage rm-tweaks-v3 */
--plat-supplier: #4DAC77   /* RGB 77/172/119 — supplier green, the user's confirmed default */
--plat-curator:  #8B5CF6
--plat-sales:    #3B82F6

/* Mesh gradient applied on .app-root.platform-supplier — supplier sees green/yellow/cyan blob blend */
--mesh-supplier: <multi-radial-gradient defined in styles.css>
```

The screen wrapper `.v2.platform-supplier` is set to `background: transparent` so the mesh on `.app-root` shows through without double-paint flash on route changes.

### 4.2 Skin v2 (`app/src/skin-v2.css`)

Additive skin layer that opts in via the `v2` class on the screen wrapper. Defines:

- Type ramp: `.v2-display`, `.v2-h2`, `.v2-h2--sm`, `.v2-h3`, `.v2-lede`, `.v2-meta`, `.v2-eyebrow`, `.v2-code-label` (mono)
- Containers: `.v2-page`, `.v2-page--narrow`, `.v2-page--wide`, `.v2-section`, `.v2-section__head`, `.v2-section__head--actions` (with right-side action cluster)
- Surfaces: `.v2-input-card` (white, soft border, soft shadow), `.v2-pane`
- Status pills: `.v2-status-pill--ai|review|ok|needs|weak`
- Chips: `.v2-chip` (default), `.v2-chip--active` (solid platform color + white text)
- Validation: `.text-input.error`, `.field-label.error`, `.field-error` (red `⚠` line), `.v2-banner-error`
- Buttons: `.v2-btn-quiet` (borderless text button with hover tint)
- Utilities: `.v2-cluster`, `.v2-grow`, `.v2-stack`, `.v2-hr`

### 4.3 Header

- White, 60px, sticky top: 0, z-index: 11
- Brand mark + "RoleMaster" + platform pill ("供应商") + supplier name
- Right side: notification bell, "退出", language switch
- 2px gradient stripe along the bottom that fades from transparent → platform color → transparent

### 4.4 Stepper

- Sticky top: 60 (right under header), z-index: 10
- 8 numbered circles + labels, completed = green check, current = filled circle, future = empty
- Inline below header in the AppHeader render

---

## 5. Data model (D1)

```
suppliers ─┬─ supplier_company_info (1:1, contact + company fields)
           └─ intakes (1:N) ─┬─ intake_files (1:N)
                             ├─ capabilities_v2 (1:N) — RC-NN labels
                             └─ rolepacks_v2 (1:N) — RP-NN labels
                                  └─ rolepack_chat_messages (1:N — copilot history)

users (auth) — separate table. JWT payload = { sub, email, role, sup }
notifications (T5.3 — in-app inbox)
```

Key columns:
- `intakes.status`: draft | submitted | published
- `intakes.service_pricing_json`: JSON blob with service + pricing values
- `rolepacks_v2.questionnaire_json`: JSON blob with all questionnaire field answers, each `{ value_zh, value_en, confidence, source_quote, _state }`
- `rolepacks_v2.generated_json`: AI-finalized sales-ready content (set by `/generate` endpoint after submit)

---

## 6. AI surfaces (`functions/api/_lib/ai/`)

| Surface | Endpoint | Model | Prompt file |
|---|---|---|---|
| Capability extraction | `POST /intakes/:id/extract-capabilities` | `claude-haiku-4-5` | `prompts/capabilities.js` |
| Role matching | `POST /intakes/:id/match-roles` | `claude-haiku-4-5` | `prompts/roles.js` |
| Questionnaire prefill | `POST /intakes/:id/rolepacks/:rpId/prefill` | `claude-haiku-4-5` | `prompts/role-prefill.js` |
| Copilot chat | `POST /intakes/:id/rolepacks/:rpId/copilot` | `claude-haiku-4-5` | `prompts/copilot.js` |
| Role finalize (post-submit) | `POST /intakes/:id/rolepacks/:rpId/generate` | `claude-haiku-4-5` | `prompts/role-finalize.js` |

All AI calls go through `_lib/ai/client.js::callClaude()`. Strict JSON output is parsed by `_lib/ai/parse.js::parseStrictJson()`. Costs are logged to the `ai_cost_log` table via `_lib/ai/logging.js`.

**Copilot field_id contract**: the prompt enumerates a CLOSED list of field_ids (profile.daily_activities, pain.main_pain, etc.) which MUST match `FIELD_LABELS` in `copilot.js`. Any unrecognized id is silently dropped — be careful when changing either side.

---

## 7. Known limitations / future work

1. **Industry taxonomy data has English-only items** — items like `manufacturing`, `healthcare`, `government`, `professional`, `electronics_signal`, `real_estate`, `energy` lack `name_zh`. Until backfilled, those chips display in EN even when `lang === 'zh'`. Frontend `filterByLang` (in `roles.jsx`) hides them from the dropdown so users can't pick more, but already-selected ones still render. **Fix**: backfill `name_zh` in the `industries` taxonomy table.
2. **Service-pricing per-field red borders** — current validation surfaces a banner; for a stricter UX wrap each picker to apply red border on missing.
3. **Cookie scope** — preview deploys (`<hash>.rolemaster.pages.dev`) don't share cookies with the canonical (`rolemaster.pages.dev`). Test on canonical for "logged-in" flows or expect to log in fresh on each preview.
4. **Industry/size custom items** persist as `custom:<text>` IDs. They show as plain text in chips but won't get language treatment because they have no taxonomy entry. This is intentional — supplier may type something we don't know.

---

## 8. File map (the parts that matter)

```
app/
├── src/
│   ├── App.jsx                          ← routes, AppShell, StepperContext.Provider
│   ├── chrome.jsx                       ← AppHeader (sticky), ProcessStepper, Brand
│   ├── api.js                           ← fetch wrapper with safe JSON parsing
│   ├── auth.jsx                         ← AuthProvider + useAuth hook
│   ├── tweaks.jsx                       ← TweaksPanel (color/font/density tweaks)
│   ├── styles.css                       ← legacy + global tokens (colors, .app-header, .btn-*)
│   ├── skin-v2.css                      ← v2 skin (additive — only applies under .v2 class)
│   └── screens/
│       ├── landing.jsx                  ← /
│       ├── portal-login.jsx             ← /supplier (when logged out), /curator, /sales
│       ├── supplier-home.jsx            ← /supplier dashboard
│       └── v2/
│           ├── register.jsx             ← /supplier/register
│           ├── company-setup.jsx        ← /supplier/company-setup (with contact fields)
│           ├── onboard.jsx              ← /supplier/onboard[/:id]
│           ├── capabilities.jsx         ← /supplier/intake/:id/capabilities
│           ├── roles.jsx                ← /supplier/intake/:id/roles  (filterByLang for industries)
│           ├── role-details.jsx         ← /supplier/intake/:id/role/:rpId/details + Copilot
│           ├── service-pricing.jsx      ← /supplier/intake/:id/service-pricing
│           ├── review.jsx               ← /supplier/intake/:id/review (CapRow stacked + ▶)
│           ├── done.jsx                 ← /supplier/intake/:id/done
│           ├── HierarchicalPicker.jsx   ← multi-select dropdowns (CheckboxBox visible boxes)
│           ├── KnowledgeCards.jsx       ← AI-loading carousel (taller, lightbulb)
│           └── StatusBanner.jsx         ← UnderReviewBanner / PublishedBanner / isLocked()
└── vite.config.js                       ← outDir: '../dist' — IMPORTANT

functions/
├── api/
│   ├── _middleware.js                   ← JWT auth gate
│   ├── _helpers.js                      ← json(), SUPPLIER_SCOPED_FIELDS, writeSupplierCompanyField
│   ├── auth/                            ← login, register, logout, me
│   ├── suppliers/me/company-info.js     ← GET/PATCH (with auto contact-column migration)
│   ├── intakes/                         ← intake CRUD + rolepack/capability sub-resources
│   │   └── [id]/rolepacks/[rpId]/copilot.js  ← Copilot endpoint
│   ├── taxonomy/                        ← industries, regions, departments, company-sizes
│   ├── curator/                         ← curator endpoints
│   ├── sales/                           ← sales endpoints
│   └── _lib/ai/                         ← client.js, parse.js, logging.js, prompts/*.js
└── (Cloudflare Pages Functions auto-route from filesystem)

schema.sql                               ← canonical D1 schema
scripts/migrate-*.sql                    ← incremental migrations (apply via dashboard)
wrangler.toml                            ← project + D1 + R2 bindings
PLAN.md                                  ← active work plan + the 7 deploy commandments
SUPPLIER_PLATFORM_HANDOVER.md            ← THIS FILE
```

---

## 9. The "what changed in May 2026" delta

This week's work delivered (in order):

1. **Skin v2 rolled out** to all 12 v2 screens — additive CSS layer (`skin-v2.css`) opted into via `.v2` class on each screen wrapper.
2. **Stepper consolidated** under header (8 steps) via `StepperContext`.
3. **Supplier color confirmed** as `#4DAC77` (RGB 77/172/119) — added 10-color picker swatches in TweaksPanel.
4. **Mesh gradient** restored as default supplier background; `.v2.platform-*` is transparent so app-root mesh shows through (no flash on route change).
5. **Sticky chrome** — `app-header` sticky top: 0; `proc-stepper` sticky top: 60.
6. **Card header reorder** (caps + roles) — `RC-01 能力 N` / `RP-01 岗位 N` (code first, both small font).
7. **Section action cluster** — `+ 添加 / ↻ AI 重新…` moved to the upper-right of the section head.
8. **AI pills renamed** — `✦ AI 识别到 5 项能力` / `✦ AI 匹配到 N 个岗位`.
9. **Industry picker count** — `selected/total` badge (e.g. `15/54`) on the trigger button; new `filterByLang` hides items missing the active-language label.
10. **Validation system** — `.text-input.error` red border, `.field-label.error` red text, `.field-error` red `⚠` line, `.v2-banner-error` red banner. Cap-name, role-name, role-capability-list, all required questionnaire fields, all required service+pricing fields all gate "下一步".
11. **Sticky role-details chrome** — tab strip sticky top: 60; **white role-card header** (eyebrow + title + meta) sticky top: 105; Copilot sticky top: 105 inside flex.
12. **Localized role meta line** — industries below role name use `industries` taxonomy lookup (active language).
13. **API doc upload UI** — `[name input] [+ 上传文件]` row + per-file `[checkbox] [name] [filename] [×]`.
14. **Final review redesign** — sections converted to white `v2-input-card`; 能力 collapsed by default with stacked `RC-NN` / `能力 N` and big rotating ▶ → ▼ triangle on click; 岗位 simplified to pain + how-it-helps blocks with bold labels.
15. **Knowledge cards redesigned** — taller (240px min-height), vertically centered, lightbulb icon in tinted square, larger title (20px), longer dot indicators with active stretch.
16. **Visible checkbox boxes** in HierarchicalPicker dropdowns (`CheckboxBox` helper) and RegionPicker.
17. **Contact fields restored** on company-setup (`contact_name`, `contact_phone`, `contact_email`, all required) — backend auto-migrates columns on first GET/PATCH.
18. **JSON parse error handling** — non-JSON responses (HTML error pages, auth redirects) now surface as `Server returned HTML (HTTP N). Likely auth lost or endpoint missing.` instead of `Unexpected token '<'`.
19. **Copilot field_id contract enforced** — prompt now enumerates the EXACT 11 valid field_ids that match `FIELD_LABELS` in the copilot endpoint. Eliminates the "AI seems to acknowledge but nothing fills" bug from the field_id mismatch.
20. **Copilot proactive next-up pills** — under every latest bot reply, render top-4 remaining empty fields as click-to-draft pills.
21. **Done page card view** — `/done` switched from `v2-row` hairline list to `v2-input-card` per role. Each card stacks `RP-NN` + `岗位 N / Role N` on the left, status pill on the right, role name below in 16px bold, then a meta line, then `查看完整 →` link. Section head matches the `--actions` layout from caps/roles.
22. **Notification bell green-tinted** — unread items in the dropdown now use a 12% green tint background + 3px green left border (was purple `--cop-bg`). Unread badge counter is `var(--plat-supplier)` with white halo (was red `#DC2626`). Both match the supplier theme.
23. **Role-details header un-stickied** — earlier we made the eyebrow + title + meta a sticky white bar; that fought with the green mesh background and the Copilot. Reverted: only `app-header` (top: 0) and the **role tab strip** (top: 60) are sticky now. The role-card header (eyebrow + title + meta) is left-aligned on the green background, scrolls with the form.
24. **Company size localized in role-details meta** — the meta line now also looks up `company_size` IDs through the `company-sizes` taxonomy, so a zh user no longer sees raw `mid · enterprise` — they see `中型 · 大型`. Loaded once via `taxonomy.companySizes()`.
25. **Review caps triangle minimized** — was a 22×22 button with green tint background; now a plain 14×14 ▶ glyph that rotates 90° to ▼ on click, no background fill. Less visual weight when the page has many caps.

## 10. Operational gotchas (lessons learned the hard way)

1. **NEVER deploy `app/dist`.** That directory contains a stale May-1 build from before this codebase reorganized vite output. Deploys go to `dist/` at the project root.
2. **Cookie scope across deploys** — `<hash>.rolemaster.pages.dev` previews don't share the canonical cookie. Always test "logged-in" flows on the canonical or expect to log in fresh on each preview hash.
3. **D1 ALTER TABLE permissions** — current CLI token can't `wrangler d1 execute --remote`. Idempotent `ALTER TABLE … ADD COLUMN` wrapped in try/catch (see `company-info.js::ensureContactColumns`) is the in-handler workaround. Never assume a column exists in production until you've confirmed the schema or the auto-migration has run.
4. **Copilot field_id contract** — the prompt's enumerated field_ids MUST equal the keys in `FIELD_LABELS`. A mismatch silently drops AI updates and the supplier sees a chatbot that "hears" but never fills anything.
5. **`background: transparent` shorthand** — wins over `background-image` from a less-specific selector. We rely on this so `.v2.platform-supplier { background: transparent }` cancels the platform mesh on the screen wrapper while the persistent `.app-root.platform-supplier` keeps painting it. Don't accidentally remove the `.v2` selector — you'll get a double-paint flash on route change.

## 11. Curator + Solution Advisor surfaces (added 2026-05-03 from curator lane merge)

The curator-lane prototype landed when the multi-lane workflow consolidated. Lives in `app/src/screens/other.jsx` (~1700 lines).

### `/curators` — kanban inbox (`ScreenQueue`)
- Bilingual zh/en columns: New / In review / Meeting / Needs revision / Approved
- Drag-to-move between columns
- Two view modes: kanban + Capability Partner groups (`SupplierGroupsView`)
- Lead-only "team view" toggle for triaging across curators
- `?preview=1` URL flag bypasses auth so the prototype renders without login

### `/curators/intake/:id` — workbench (`ScreenWorkbench`)
- AI briefing banner at top (auto-summarized from intake)
- Phase indicator: Review → Meeting → Finalize
- Paste-notes diff Copilot pane (paste meeting notes, get structured updates)
- Audit log per intake
- `?preview=1` flag too

**Demo data** lives inline in `screens/other.jsx` (constants `QUEUE`, `DEMO_INTAKE`, `DEMO_CURATORS`). Move to `data.js` if/when this is wired to real backend data.

**Curator-owned files (now part of consolidated codebase):**
- `app/src/screens/other.jsx` (`ScreenQueue` + `ScreenWorkbench`)
- Curator CSS blocks in `app/src/styles.css` (search "Curator inbox" / "Curator workbench" section headers)
- `s6_*` / `s7_*` keys in `app/src/i18n.js`
- `App.jsx` routes: `CuratorLanding` + `CuratorWorkbenchRoute`

### Solution Advisor (`/advisors`)
- `/advisors` → `SalesLanding` → `ScreenSalesLibrary` (browse RolePack catalog)
- `/advisors/rolepack/:id` → `V2SalesRolepackRoute` → `ScreenV2SalesRolepack`
- Lives in `app/src/screens/v2/sales-library.jsx`
- Same backend `role: 'sales'` JWT (only the URL + UI label changed)

## 12. Email + Agreement docs (added 2026-05-03)

- [docs/email-templates.md](docs/email-templates.md) — five bilingual transactional email templates: Welcome, Submission received, Approved, Revision requested, Meeting hold. Trigger points already exist in backend; just need an email-send helper wired up to a provider (SendGrid / Postmark / Mailgun / Cloudflare Email Routing).
- [docs/CAPABILITY_PARTNER_AGREEMENT.md](docs/CAPABILITY_PARTNER_AGREEMENT.md) — bilingual draft of the Capability Partner Agreement (parties, scope, IP, confidentiality, data, fees, term, liability, governing law). DRAFT — needs legal review before binding use. Current draft uses Hong Kong law / HKIAC arbitration as a starting point.

## 13. Domain (added 2026-05-03)

- Custom domains: `airolemaster.com` + `www.airolemaster.com` attached to the `rolemaster` Cloudflare Pages project.
- Apex 301-redirects to www via a Redirect Rule on the `airolemaster.com` zone (Rules → Redirect Rules → "Apex to www").
- `www.airolemaster.com` is the only canonical URL.
- The legacy `*.rolemaster.pages.dev` URLs still serve previews and the production deploy.

## 14. Curator end-to-end status (2026-05-03)

**What works end-to-end now:**
- `/curators` dashboard fetches real partner submissions via `GET /api/curator/intakes?status=all` (drafts filtered out frontend-side)
- 2 demo cards (`Helix KYC (DEMO)` final, `Stratify Risk (DEMO)` published) supplement live data so columns aren't empty
- Curator clicks any submission → `/curators/intake/:id` workbench loads via `GET /api/intakes/:id` (curator role allowed)
- Workbench reads real intake + capabilities + rolepacks + files
- **Curator can chat with Copilot in Review phase** — calls `POST /api/intakes/:id/rolepacks/:rpId/copilot` (curator role allowed) targeting the FIRST rolepack of the intake; AI fills questionnaire fields and persists; workbench refetches to show updates

**Backend endpoints now allowing curator role (in addition to supplier):**
- `PATCH /api/intakes/:id/rolepacks/:rpId` — edit rolepack name/questionnaire/capabilities
- `DELETE /api/intakes/:id/rolepacks/:rpId`
- `PATCH /api/intakes/:id/capabilities/:capId` — edit capability name/description
- `DELETE /api/intakes/:id/capabilities/:capId`
- `POST/GET /api/intakes/:id/rolepacks/:rpId/copilot`

Suppliers are still scoped to their own intake; curators can edit any.

**Still demo-only / TODO:**
- Workbench's Meeting-phase **paste-notes diff list** uses `buildDemoDiffs()` (local mock). For real notes-to-diffs processing, add a new endpoint that takes raw notes + intake context and returns structured field updates.
- Workbench has no explicit "Save edits" button — direct field edits in `WorkbenchForm` aren't persisted yet (only the Copilot chat persists).
- Curator-initiated **publish** action UI not connected to `POST /api/curator/rolepacks/:rpId/publish`. Drag-to-published-column is local-only.
- Multi-rolepack intakes: Copilot chat targets only the first rolepack. Add a rolepack picker.

## 15. Open follow-ups

- **Auth 500 on legacy seeded accounts.** `/api/auth/login` returns HTTP 500 for some pre-existing `curator@demo` / `grace@rolemaster.io` accounts. Fresh register works. New demo curator + advisor accounts created (see top of doc) bypass it. Real fix: dig into `verifyPassword` / the seed records' missing salt or hash. Not blocking the prototype.
- **Email sending.** Templates drafted; provider integration not wired.
- **Agreement.** Draft needs counsel review.
- **Industry taxonomy zh labels.** Some industry items (`manufacturing`, `healthcare`, `government`, etc.) lack `name_zh` so chips display in EN even when zh is active. Backfill the taxonomy data.
