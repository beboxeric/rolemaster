# RoleMaster Engineering Spec — Tier 4

> **Context:** This is one tier of the RoleMaster Engineering Spec. The full spec is split across 5 tier files plus README and notes. Refer to the README for shared conventions, repository structure, and ship order.

> **How to use this:** Each ticket is self-contained. Pick one ticket, read it fully, implement it, ship it. Verify against the manual verification steps. Then move to the next.

---

# Tier 4 — Confirm screen, polish, dead code

Smaller tickets that close visible gaps.

---

## Ticket T4.1 — Confirm screen: real "we generated" content

**Why:** Currently the right column is canned `AI_GENERATED` text from `data.js`. Replace with real per-submission generation.

**Scope:**

The decomposition + generated content (T1.2) already produces this content for the curator workbench. The supplier's confirm screen should show a **subset** — just the customer-voice pain narrative, value positioning, and one-liner.

But: at submit-confirm time, decomposition hasn't run yet (decompose runs AFTER submit, per T1.3). We need an earlier, lighter generation step.

Add `functions/api/submissions/[id]/preview-generated.js`:
- POST. Supplier (own submission only).
- Calls Claude with a smaller prompt: just generate `customer_voice_pain`, `value_positioning`, `one_liner` (zh + en)
- Doesn't write to DB (just returns)
- Cached client-side; the supplier gets the same preview each time they open the confirm modal

In `app/src/screens/other.jsx::ScreenConfirm`:
1. On modal open, POST to `/api/submissions/[id]/preview-generated`
2. Show loading state for ~5 sec
3. Render the returned content in the right column
4. Replace import of `AI_GENERATED` from `data.js`

**Files touched:**
- New: `functions/api/submissions/[id]/preview-generated.js`
- `app/src/screens/other.jsx`
- Remove `AI_GENERATED` from `data.js`

**Acceptance:**
- Confirm modal shows real customer-voice pain narrative based on what the supplier filled in
- Different submissions show different content
- If `ANTHROPIC_API_KEY` missing: show "Preview unavailable" gracefully (no crash)

**Dependencies:** none (can ship independently)

---

## Ticket T4.2 — Thanks screen: show the user's actual product

**Why:** `ScreenThanks` shows hardcoded TMX product list regardless of what was submitted.

**Scope:**

In `app/src/screens/other.jsx::ScreenThanks`:
- Fetch the submission via `/api/submissions/[id]`
- Show the product name, subtitle, and a confirmation that THIS specific product was submitted
- Remove the `PRODUCTS` import from `data.js`
- If supplier has multiple products, show the supplier's full product progress dashboard (per Screen 5b in the design brief)

**Files touched:**
- `app/src/screens/other.jsx`

**Acceptance:**
- Submitting Aselo → Thanks screen says "Aselo submitted, in review"
- Submitting Vigil's TMX → Thanks screen says "TMX submitted, KYX/NSX/RRX/PAX still draft"

**Dependencies:** T3.4 helps but T4.2 can ship before with single-product fallback

---

## Ticket T4.3 — Language persistence

**Why:** `lang` resets to `zh` on refresh. Annoying for English-speaking users.

**Scope:**

In `App.jsx`:
- On mount, read `localStorage.getItem('rm_lang')` for initial state, fallback `zh`
- On every change, `localStorage.setItem('rm_lang', lang)`

For logged-in users, also persist server-side:
- Add `language` column to `users` table (TEXT default 'zh')
- `PATCH /api/auth/me/language` endpoint
- On login, hydrate `lang` from server preference, fall back to localStorage, fall back to 'zh'

**Files touched:**
- `app/src/App.jsx`
- `schema.sql` (add column)
- New: `functions/api/auth/me/language.js`

**Acceptance:**
- Set language to English, refresh → stays English
- Set on Computer A, log in on Computer B → English

**Dependencies:** none

---

## Ticket T4.4 — DOCX, PPTX, voice file parsing

**Why:** These formats are uploaded but ignored by AI prefill (per audit).

**Scope:**

In `functions/api/submissions/[id]/prefill.js`:

For each file, branch by mime type:
- PDF: existing path (Claude native document blocks)
- DOCX: extract text using a Cloudflare-compatible library (e.g., `mammoth` is too heavy; consider using a Cloudflare Worker subrequest to a small text-extraction service, OR a lighter approach: convert to text on supplier-side before upload). **Recommended:** add a pre-upload step in the supplier's browser: when DOCX is selected, use a browser-side library (`docx` or similar) to extract text and store the text alongside the file.
- PPTX: similar — extract text from slides browser-side before upload
- Voice (mp3/wav/m4a): use Whisper via a Cloudflare AI binding (`@cf/openai/whisper`). Alternative: skip transcription and surface to curator that a voice file exists for them to listen to.

For v1, **scope this ticket conservatively**:
- DOCX/PPTX: extract text browser-side, upload `{file, extracted_text}`
- Voice: surface in the workbench as "listen to this voice note" link, no transcription
- Update `prefill.js` to pass text from non-PDF formats to Claude as a regular text block

**Files touched:**
- `app/src/screens/onboard.jsx` (upload step)
- `functions/api/submissions/[id]/files.js`
- `functions/api/submissions/[id]/prefill.js`
- New: small browser-side text extractor utility in `app/src/lib/extract.js`

**Acceptance:**
- Uploading a DOCX with product info → text extracted client-side → AI prefill uses it
- Uploading a PPTX → same
- Uploading an MP3 → file appears in workbench materials list with a play button (no transcription required)

**Dependencies:** none

---

## Ticket T4.5 — Delete legacy `data.js` content

**Why:** After T1.4, T1.5, T4.1, T4.2 ship, the constants in `data.js` are dead. Removing them prevents future drift.

**Scope:**

In `app/src/data.js`, delete:
- `PRODUCTS`
- `LAYERS`
- `AI_REC`
- `SALES`
- `AUDIT_LOG`
- `ROLEPACKS` (verify nothing imports it)
- `AI_GENERATED`

Keep only static lookup tables that are genuinely static (e.g., industry options if defined here, currency lists, etc.).

Run `grep -rn "from '.*data'" app/src/` to confirm no orphan imports.

**Files touched:**
- `app/src/data.js`

**Acceptance:**
- File contains only legitimately static lookup data
- App still builds and all features work

**Dependencies:** T1.4, T1.5, T4.1, T4.2

---

## Ticket T4.6 — Remove dead code: legacy ScreenSalesLogin

**Why:** `ScreenSalesLogin` in `sales.jsx` is dead — replaced by `ScreenPortalLogin`.

**Scope:**

In `app/src/screens/sales.jsx`:
- Delete `ScreenSalesLogin` component
- Remove its export
- Remove any imports referencing it (likely none, since it's unrouted)

Also remove `AssetGenerationOverlay` if T2.4 is shipped (the real overlay lives in `other.jsx`).

**Files touched:**
- `app/src/screens/sales.jsx`

**Acceptance:** App builds, no functionality regression.

**Dependencies:** T2.4 (for AssetGenerationOverlay removal)

---

