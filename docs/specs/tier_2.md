# RoleMaster Engineering Spec — Tier 2

> **Context:** This is one tier of the RoleMaster Engineering Spec. The full spec is split across 5 tier files plus README and notes. Refer to the README for shared conventions, repository structure, and ship order.

> **How to use this:** Each ticket is self-contained. Pick one ticket, read it fully, implement it, ship it. Verify against the manual verification steps. Then move to the next.

---

# Tier 2 — Real AI asset generation

When the curator hits Publish, we need to actually produce a downloadable PowerPoint and PDF. Currently the overlay is fake.

---

## Ticket T2.1 — PPT generator using pptxgenjs (Pages Functions compatible)

**Why:** Sales reps need a real .pptx they can hand to enterprise customers.

**Scope:**

Add `pptxgenjs` to root `package.json` dependencies (current version is compatible with Cloudflare Pages Functions).

Create `functions/api/rolepacks/[id]/generate-pptx.js`:
- POST. Curator/admin only.
- Reads the RolePack and its source `submission_generated`, `layer_atoms`, `sales_materials_draft`
- Builds a 6-slide deck using pptxgenjs:
  - Slide 1: Hero — RolePack name, one-liner, supplier name
  - Slide 2: Target customer — persona, industry tags, region (from submission_fields)
  - Slide 3: Customer pain — `customer_voice_pain_zh` (or _en based on `?lang=` query param)
  - Slide 4: Capabilities — pulled from `layer_atoms` where `layer = 'capability'`, top 6
  - Slide 5: Outcomes & proof — derived from supplier-provided quantified value field, with "industry baseline" framing if empty
  - Slide 6: Pricing & next steps — retail price only (NEVER cost), implementation timeline
- **CRITICAL:** Filter out cost price. Read the field but explicitly ignore it.
- Generate as Buffer
- Upload to R2 at key `rolepacks/{id}/pitch-deck-{lang}.pptx`
- UPDATE `rolepacks` table: `pitch_deck_zh_url` / `pitch_deck_en_url` (add these columns in T2.3)
- Return `{ ok: true, url: '...' }` (URL is a signed R2 URL; see T2.4 for download mechanism)

Visual style: clean white slides, navy header band (`#3B82F6`), gold accent line. No fancy graphics — text-only, professional. Match the brand palette in `styles.css`.

Generate **both** language versions (zh and en) by calling the function twice with different lang param.

**Files touched:**
- New: `functions/api/rolepacks/[id]/generate-pptx.js`
- `package.json` (root, add pptxgenjs)

**Acceptance:**
- POST to endpoint → returns `{ ok: true, url: '...' }`
- File exists in R2 at the expected key
- Downloading the file opens correctly in PowerPoint / Keynote / Google Slides
- Cost price NEVER appears in any slide

**Manual verification:**
1. Publish a RolePack
2. Hit `/api/rolepacks/{id}/generate-pptx` (POST) for both zh and en
3. Open both files locally; verify all 6 slides render correctly
4. Search the file content for the cost price value → must not appear

**Dependencies:** T1.4 (needs layer atoms), T1.5 (needs sales materials), T2.3

---

## Ticket T2.2 — PDF product manual generator

**Why:** Sales also needs a longer document for customers in due diligence.

**Scope:**

Use `puppeteer` is not available on Cloudflare Pages Functions. Use `@react-pdf/renderer` instead — it's a pure-JS PDF generator that works in serverless environments.

Add `@react-pdf/renderer` to root `package.json`.

Create `functions/api/rolepacks/[id]/generate-pdf.js`:
- POST. Curator/admin only.
- 4-page PDF in selected language:
  - Page 1: Cover with RolePack name, supplier, one-liner, industry tags
  - Page 2: Persona profile + day-in-the-life narrative (assembled from submission_fields)
  - Page 3: Pain narrative + value positioning + capability breakdown
  - Page 4: Pricing model (retail), prerequisites, deployment options, FAQ excerpt (top 5 from sales_materials_draft.faq_json)
- Same cost-price filtering as T2.1
- Upload to R2 at `rolepacks/{id}/manual-{lang}.pdf`
- UPDATE `rolepacks` row with `product_manual_zh_url` / `product_manual_en_url`

**Files touched:**
- New: `functions/api/rolepacks/[id]/generate-pdf.js`
- `package.json` (root)

**Acceptance:**
- File generated, uploaded to R2, URL stored on RolePack
- Opens correctly in PDF viewer
- Both zh and en variants exist
- No cost price appears

**Dependencies:** T2.3

---

## Ticket T2.3 — Schema additions for asset URLs and asset generation status

**Scope:**

Extend `rolepacks` table in `schema.sql`:

```sql
ALTER TABLE rolepacks ADD COLUMN pitch_deck_zh_url TEXT;
ALTER TABLE rolepacks ADD COLUMN pitch_deck_en_url TEXT;
ALTER TABLE rolepacks ADD COLUMN product_manual_zh_url TEXT;
ALTER TABLE rolepacks ADD COLUMN product_manual_en_url TEXT;
ALTER TABLE rolepacks ADD COLUMN asset_status TEXT DEFAULT 'pending' 
  CHECK (asset_status IN ('pending', 'generating', 'ready', 'failed'));
ALTER TABLE rolepacks ADD COLUMN asset_generated_at INTEGER;
ALTER TABLE rolepacks ADD COLUMN asset_failed_reason TEXT;
```

(D1 supports ALTER TABLE ADD COLUMN; if the schema apply approach is full-replace, add to the rolepacks CREATE.)

**Files touched:** `schema.sql`

**Acceptance:** Columns exist; `wrangler d1 execute --command="PRAGMA table_info(rolepacks)"` shows them.

**Dependencies:** none

---

## Ticket T2.4 — Asset generation orchestrator triggered on Publish

**Why:** Publish currently calls `publish.js` which inserts the rolepack row; after that the supplier and sales see nothing. We need to chain asset generation.

**Scope:**

In `functions/api/curator/submissions/[id]/publish.js`:
1. After successful rolepack creation, set `asset_status = 'generating'`
2. Inline-call (sequentially) all four generators: pptx-zh, pptx-en, pdf-zh, pdf-en
3. On all-success: `asset_status = 'ready'`, `asset_generated_at = now`
4. On any failure: `asset_status = 'failed'`, `asset_failed_reason = '...'`. Other assets that succeeded keep their URLs. Curator can manually retry from a button (see below).
5. Return `{ ok: true, rolepack_id, asset_status }` — frontend polls if `generating`, but in Pages Functions inline call this is already complete by response time

In `app/src/screens/other.jsx::ScreenPublish`:
1. The fake animated `AssetGenerationOverlay` (currently in sales.jsx) is removed
2. Replace with a real progress indicator: 4 steps (PPT-zh, PPT-en, PDF-zh, PDF-en), each turning ✓ as the API response comes back
3. Inline-call doesn't give per-step updates, so split into 4 separate API calls from the frontend; each takes ~5-10 sec
4. On completion, show "📊 销售物料已生成 / Sales materials ready" with download links

Add curator action: in the curator queue (ScreenQueue), if any RolePack has `asset_status = 'failed'`, show a "🔄 Retry" button → POST `/api/rolepacks/[id]/regenerate-assets`

New endpoint `functions/api/rolepacks/[id]/regenerate-assets.js`:
- POST, curator only
- Re-runs all four generators
- Updates status

**Files touched:**
- `functions/api/curator/submissions/[id]/publish.js`
- New: `functions/api/rolepacks/[id]/regenerate-assets.js`
- `app/src/screens/other.jsx::ScreenPublish` (rewrite the overlay portion)
- Remove dead code: `AssetGenerationOverlay` from `app/src/screens/sales.jsx`

**Manual verification:**
1. Curator approves and publishes a submission
2. ScreenPublish shows a 4-step progress: PPT (zh), PPT (en), PDF (zh), PDF (en)
3. Each step turns ✓ as the API call completes (or red ✗ if failed)
4. After all 4 done, curator clicks "view in catalog" → sales catalog shows the new RolePack with downloadable assets

**Dependencies:** T2.1, T2.2, T2.3

---

## Ticket T2.5 — Sales catalog: real asset downloads

**Why:** Currently the download button shows a toast, doesn't serve a file.

**Scope:**

In `app/src/screens/sales.jsx::ScreenRolepackDetail`:
- Replace toast-only download buttons with real download links
- Buttons: "📊 销售幻灯片 (中文/EN)" and "📋 产品手册 (中文/EN)" — 4 buttons, only show if URL exists
- Click triggers download via signed R2 URL

Backend: signed R2 URLs need to be generated (R2 default is private). Two options:

**Option A (chosen — simpler):** Public R2 bucket subset.
- Don't make the whole bucket public.
- Add an endpoint: `GET /api/rolepacks/[id]/download/[asset_type]` where `asset_type` is `pitch-zh`, `pitch-en`, `manual-zh`, `manual-en`
- Endpoint reads the URL from D1, fetches from R2 (server-side), streams to client with appropriate Content-Disposition header
- Sales auth required

This avoids signed URL complexity and keeps access control centralized.

**Files touched:**
- New: `functions/api/rolepacks/[id]/download/[asset].js`
- `app/src/screens/sales.jsx` (replace toast handlers with download links)
- `app/src/i18n.js`

**Manual verification:**
1. Open a RolePack as sales
2. Click each of the 4 download buttons
3. Real .pptx and .pdf files download with sensible filenames (e.g., `RP-AML-pitch-deck-zh.pptx`)
4. Try as a logged-out user → 401

**Dependencies:** T2.1, T2.2, T2.4

---

