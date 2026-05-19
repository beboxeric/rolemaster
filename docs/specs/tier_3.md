# RoleMaster Engineering Spec — Tier 3

> **Context:** This is one tier of the RoleMaster Engineering Spec. The full spec is split across 5 tier files plus README and notes. Refer to the README for shared conventions, repository structure, and ship order.

> **How to use this:** Each ticket is self-contained. Pick one ticket, read it fully, implement it, ship it. Verify against the manual verification steps. Then move to the next.

---

# Tier 3 — Multi-product per supplier

Today: one supplier = one submission = one product. Vigil (5 product lines) can't be onboarded.

---

## Ticket T3.1 — Schema: products as first-class entities

**Why:** Need to model multiple products under one supplier; submissions become per-product.

**Scope:**

Currently `submissions` IS the product. Refactor:

```sql
-- New table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  name TEXT NOT NULL,            -- e.g. "TMX"
  subtitle TEXT,                  -- e.g. "AML Monitoring"
  position INTEGER DEFAULT 0,    -- ordering within supplier
  created_at INTEGER NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Add column to submissions
ALTER TABLE submissions ADD COLUMN product_id TEXT;
-- For existing submissions, create a default product per submission and backfill
```

Migration plan:
1. Add `products` table
2. Add `product_id` column to `submissions`
3. For each existing submission, INSERT a `products` row using the submission's product name, then UPDATE the submission with that `product_id`
4. After backfill, make `product_id` NOT NULL (in a future migration; not blocking)

Also: company info that should be shared across products of the same supplier moves to `suppliers` table or a new `supplier_company_info` table:

```sql
CREATE TABLE IF NOT EXISTS supplier_company_info (
  supplier_id TEXT PRIMARY KEY,
  team_size_zh TEXT,
  team_size_en TEXT,
  year_founded TEXT,
  customer_count_zh TEXT,
  customer_count_en TEXT,
  updated_at INTEGER,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);
```

In `_fields-template.js`, mark Section 1 fields as "shared" (a new `scope: 'supplier'` flag); the form code in T3.3 handles them differently.

**Files touched:**
- `schema.sql`
- Backfill script: `scripts/migrate-products.mjs`

**Acceptance:**
- All existing submissions have a `product_id` pointing to a real `products` row
- Supplier company info exists in the new table for all suppliers (backfilled from current submissions)

**Dependencies:** none

---

## Ticket T3.2 — API: list products per supplier, add/remove products

**Scope:**

New endpoints:

- `GET /api/suppliers/me/products` — list current supplier's products with their submission status
- `POST /api/suppliers/me/products` — body `{ name, subtitle? }`. Creates a `products` row + a draft `submissions` row linked to it.
- `DELETE /api/suppliers/me/products/[productId]` — only allowed if submission status is `draft`. Cascades.
- `PATCH /api/suppliers/me/products/[productId]` — rename product

All require supplier auth, and enforce ownership (supplier can only touch their own products).

Update `GET /api/submissions` to filter by `?product_id=` if provided, and return the product info inline.

**Files touched:**
- New: `functions/api/suppliers/me/products.js`
- New: `functions/api/suppliers/me/products/[productId].js`
- `functions/api/submissions/index.js` (extend GET filter)

**Acceptance:**
- Supplier can list, create, rename, delete their products via API

**Dependencies:** T3.1

---

## Ticket T3.3 — Multi-product detection during upload + identify

**Why:** When a supplier uploads materials covering multiple products (Vigil), AI should detect and offer to create them all.

**Scope:**

Extend `functions/api/submissions/[id]/prefill.js`:
- After existing per-submission prefill, ALSO call Claude with a "multi-product detection" prompt:

```
Analyze the supplier's materials. Are these materials describing:
(a) a single product with multiple capabilities (one persona, one workflow), OR
(b) multiple distinct products (different personas or workflows)?

If (b), list each product with a name, short description, and the persona it serves.
Output JSON: { "is_multi": true|false, "products": [{ "name": "...", "subtitle": "...", "rationale": "..." }] }
```

If `is_multi: true`:
- Don't auto-create multiple products (let supplier confirm)
- Return the detection in the prefill response

In `app/src/screens/onboard.jsx::ScreenMulti` (the "identify" stage):
- If multi-product detected, render a confirmation panel: "We found N products in your materials. Want to set them all up?"
- Each detected product is a checkbox (default checked); supplier can uncheck or rename
- Three radio options:
  1. Set up all N separately (recommended)
  2. Treat as one combined product
  3. Just set up one (let supplier pick which)
- On confirm: 
  - Option 1: Create N `products` rows + N draft submissions; route supplier to first product's form
  - Option 2: Keep current single submission; rename per supplier input
  - Option 3: Keep one chosen, archive the rest

**Files touched:**
- `functions/api/submissions/[id]/prefill.js`
- `app/src/screens/onboard.jsx::ScreenMulti`
- `app/src/i18n.js`

**Acceptance:**
- Upload Vigil's deck → supplier sees "We found 5 products" panel
- Upload Aselo's deck → supplier sees no multi-product prompt (or sees "1 product detected" with no selection)
- After confirming multi-product, supplier dashboard shows N product cards

**Dependencies:** T3.1, T3.2

---

## Ticket T3.4 — Form: real product tabs

**Why:** Tabs in `form.jsx` currently render the hardcoded `PRODUCTS` array. Make them switch between real products of the same supplier.

**Scope:**

In `app/src/screens/form.jsx`:

1. Remove import of `PRODUCTS` from `data.js`
2. On mount, fetch the current supplier's products via `GET /api/suppliers/me/products` (cached in context)
3. The tab strip renders these products with their actual statuses (draft / submitted / etc.)
4. Active tab = current `:id` route param
5. Clicking another tab navigates to that product's form route
6. The "+" button at the end opens a modal to add a new product (POST products + new submission, navigate to it)

Section 1 (公司基础) handling:
- These fields use `scope: 'supplier'` (per T3.1's template change)
- When the form mounts, hydrate Section 1 fields from `supplier_company_info` instead of `submission_fields`
- When supplier edits Section 1, save to `supplier_company_info` (single row updated for the supplier)
- Show a small badge on Section 1: "🔗 此部分对所有产品共享 / Shared across all products"
- Same edits visible across all product tabs

In `app/src/screens/supplier-home.jsx`:
- Replace any hardcoded product list with a real fetch
- Each card shows product name, status, last edited, % complete

**Files touched:**
- `app/src/screens/form.jsx`
- `app/src/screens/supplier-home.jsx`
- `app/src/api.js`
- `app/src/i18n.js`

**Acceptance:**
- Supplier can switch between TMX, KYX, NSX, RRX, PAX in the form
- Editing company name in TMX immediately reflects in KYX
- Adding a new product via "+" works
- Removing a draft product works

**Dependencies:** T3.1, T3.2, T3.3

---

