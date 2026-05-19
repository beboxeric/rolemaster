# RoleMaster Engineering Spec — Tier 5

> **Context:** This is one tier of the RoleMaster Engineering Spec. The full spec is split across 5 tier files plus README and notes. Refer to the README for shared conventions, repository structure, and ship order.

> **How to use this:** Each ticket is self-contained. Pick one ticket, read it fully, implement it, ship it. Verify against the manual verification steps. Then move to the next.

---

# Tier 5 — Hardening

Cross-cutting tickets that improve resilience and complete the platform.

---

## Ticket T5.1 — Audit log UI for curators

**Why:** `audit_log` table exists, gets written to, but isn't visible anywhere in the UI.

**Scope:**

In the curator workbench (`workbench.jsx`):
- Add a fourth pane (or a toggle button to expand): "审计日志 / Audit log"
- Lists all audit entries for this submission, newest first
- Each entry: timestamp, user (email), action, before/after summary if applicable
- Filterable by action type (created, updated, decompose, publish, etc.)

API: `GET /api/submissions/[id]/audit` — curator only.

**Files touched:**
- New: `functions/api/submissions/[id]/audit.js`
- `app/src/screens/workbench.jsx`
- `app/src/i18n.js`

**Acceptance:** Curator can see all actions taken on a submission in chronological order.

**Dependencies:** none

---

## Ticket T5.2 — Curator-supplier comment thread

**Why:** Per the design brief, when curator marks "Needs Revision," supplier should see comments and respond. Currently `decision.js` writes a `review_notes` string but there's no thread UI.

**Scope:**

New table:

```sql
CREATE TABLE IF NOT EXISTS submission_comments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_role TEXT NOT NULL,    -- 'curator' or 'supplier'
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
CREATE INDEX idx_comments_submission ON submission_comments(submission_id, created_at);
```

API:
- `GET /api/submissions/[id]/comments` — supplier (own) or curator
- `POST /api/submissions/[id]/comments` — body `{ body }`. Author derived from session.

UI:
- Curator workbench right pane: comment thread + new-comment input
- Supplier dashboard: when a submission has `needs_revision` status, show comments inline
- Supplier form: comment thread accessible via a button in the header

**Files touched:**
- `schema.sql`
- New: `functions/api/submissions/[id]/comments.js`
- `app/src/screens/workbench.jsx`
- `app/src/screens/supplier-home.jsx`
- `app/src/screens/form.jsx`
- `app/src/i18n.js`

**Acceptance:**
- Curator marks Needs Revision with a comment → supplier sees it
- Supplier replies → curator sees it
- Both sides see full thread chronologically

**Dependencies:** none

---

## Ticket T5.3 — Submission status notifications (in-app)

**Why:** When curator approves or requests changes, supplier currently sees no signal until they refresh.

**Scope:**

Add `notifications` table:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,            -- 'approved', 'needs_revision', 'comment'
  payload_json TEXT,             -- { submission_id, message, ... }
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_notifs_user ON notifications(user_id, read_at, created_at);
```

API:
- `GET /api/notifications` — current user's notifications
- `POST /api/notifications/mark-read` — body `{ ids: [] }`

Frontend:
- Bell icon in app header for logged-in users; shows unread count badge
- Click → dropdown listing notifications, click one → navigate to relevant submission
- Polled every 60 seconds while user is active

Trigger points (insert notifications in these handlers):
- `decision.js` when status set to `approved`, `needs_revision`, or `published`
- `comments.js` when a curator comments on a supplier's submission (and vice versa)

**Files touched:**
- `schema.sql`
- New: `functions/api/notifications.js`
- New: `functions/api/notifications/mark-read.js`
- `app/src/chrome.jsx` (add NotificationBell)
- `app/src/screens/*` (poll on relevant pages)
- Various API handlers (insert notifications)

**Acceptance:**
- Approve a submission → supplier's bell icon shows red dot within 60 sec
- Click bell → see "Your TMX has been approved!" → click → navigate to supplier dashboard
- After clicking, badge clears

**Dependencies:** T5.2 helps but not required

---

## Ticket T5.4 — Sales-rep telemetry (lightweight)

**Why:** Per design, no individual sales accounts but we should know rough usage. The `sales_sessions` table exists in spec but not the schema.

**Scope:**

Add `sales_sessions` table:

```sql
CREATE TABLE IF NOT EXISTS sales_sessions (
  id TEXT PRIMARY KEY,
  email TEXT,                  -- optional: who claimed to log in
  ip_address TEXT,
  user_agent TEXT,
  signed_in_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sales_sess_signin ON sales_sessions(signed_in_at);
```

(Note: the existing auth uses a single shared sales user. The `sales_sessions` table is supplementary — to track who's using the shared login.)

In `auth/login.js`: when a user with `role = 'sales'` logs in, also INSERT a `sales_sessions` row.

Add `GET /api/admin/sales-sessions` — admin only — returns recent sessions for monitoring.

A simple admin view (optional in v1, but stub in for future).

**Files touched:**
- `schema.sql`
- `functions/api/auth/login.js`
- New: `functions/api/admin/sales-sessions.js`

**Acceptance:**
- Each sales login creates a session row
- Admin can query / view recent sessions

**Dependencies:** none

---

## Ticket T5.5 — Industry tag taxonomy

**Why:** Per design brief and audit, sales catalog filters use static option lists. Need a controlled taxonomy that curators can extend.

**Scope:**

```sql
CREATE TABLE IF NOT EXISTS taxonomy_industries (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  parent_id TEXT,            -- for sub-industries
  display_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES taxonomy_industries(id)
);
```

Seed with the initial industries from the brief (Banking, Insurance, Securities, Retail, Manufacturing, Healthcare, Government, Professional Services, etc.) — `seed.sql`.

API:
- `GET /api/taxonomy/industries` — public-ish (curator + sales + supplier)
- `POST /api/taxonomy/industries` — admin only — create new
- `PATCH /api/taxonomy/industries/[id]` — admin
- `DELETE` — admin

In sales catalog filters: replace the static industry option list with a fetch.
In curator workbench: replace the industry selector with a fetch + ability to "request a new tag" that creates a pending taxonomy item.

**Files touched:**
- `schema.sql`
- `seed.sql`
- New: `functions/api/taxonomy/industries.js`
- New: `functions/api/taxonomy/industries/[id].js`
- `app/src/screens/sales.jsx`
- `app/src/screens/workbench.jsx`

**Acceptance:**
- Sales filter dropdown reflects DB
- Curator can add a new industry tag mid-review
- All RolePacks tagged with valid taxonomy IDs

**Dependencies:** none

---

## Ticket T5.6 — Error tracking and request logging

**Why:** Pages Functions catch unhandled errors, but we have no observability. Failed Claude calls, malformed JSON, R2 timeouts — all silent.

**Scope:**

Add a lightweight logging utility in `functions/api/_helpers.js`:

```js
export async function logEvent(env, level, message, context = {}) {
  // Insert into a logs table for later inspection
  await env.DB.prepare(
    `INSERT INTO platform_logs (id, level, message, context_json, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), level, message, JSON.stringify(context), Date.now()).run();
}
```

Add table:

```sql
CREATE TABLE IF NOT EXISTS platform_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,             -- 'info', 'warn', 'error'
  message TEXT NOT NULL,
  context_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_logs_level_time ON platform_logs(level, created_at);
```

Wrap every external call (Claude, R2 upload, R2 fetch) in try/catch and log failures.

Admin endpoint: `GET /api/admin/logs?level=error&since=...`

**Files touched:**
- `schema.sql`
- `functions/api/_helpers.js`
- All endpoints that call Claude or R2 (wrap calls)
- New: `functions/api/admin/logs.js`

**Acceptance:**
- Forcing a Claude call to fail (invalid key) logs an `error` entry
- Admin can fetch recent errors

**Dependencies:** none

---

## Ticket T5.7 — UAT environment provisioning

**Why:** `wrangler.uat.toml` exists but the UAT D1 / R2 / Pages project never created.

**Scope:**

Provision real UAT resources:
1. `wrangler d1 create rolemaster-db-uat` — record the new ID
2. `wrangler r2 bucket create rolemaster-files-uat`
3. Create a Pages project `rolemaster-uat` in Cloudflare dashboard (linked to same repo, branch `uat`)
4. Update `wrangler.uat.toml` with real IDs
5. Apply schema: `wrangler d1 execute rolemaster-db-uat --remote --file=schema.sql`
6. Update `scripts/deploy.mjs` to support UAT branch

`npm run deploy:uat` should now actually deploy.

**Files touched:**
- `wrangler.uat.toml`
- `scripts/deploy.mjs`
- README.md (document the dual-environment workflow)

**Acceptance:**
- `npm run deploy:uat` deploys successfully
- UAT URL is distinct from prod
- UAT has its own DB and R2

**Dependencies:** none — environmental, not blocked by features

---

## Ticket T5.8 — Cost price hard guard

**Why:** Cost price leakage is the single highest-stakes data-protection concern. Currently relies on each handler manually filtering. One forgetful handler leaks it.

**Scope:**

Add a centralized response sanitizer in `_helpers.js`:

```js
const SENSITIVE_FIELDS = [
  'cost_price_zh', 'cost_price_en', 'cost_price',
  'review_notes', 'audit_log', 'curator_notes',
  'capability_ids', 'knowledge_ids', 'interface_ids', 
  // ... see access-control matrix in requirements
];

export function sanitizeForRole(data, role) {
  if (role === 'curator' || role === 'admin') return data;
  // For supplier and sales: strip sensitive fields recursively
  return stripFields(data, SENSITIVE_FIELDS);
}
```

In every API route that returns data:
- Wrap response: `return jsonResponse(sanitizeForRole(payload, user.role))`

Add a startup test (one-off script) that hits each public endpoint as a sales user and asserts no sensitive field appears.

**Files touched:**
- `functions/api/_helpers.js`
- All `GET` API handlers (one-line change each)
- New: `scripts/test-leakage.mjs`

**Acceptance:**
- Search response payload as sales role for `cost_price` — never present
- Run leakage test → all green

**Dependencies:** none — but ship before any new endpoints to ensure they inherit protection

---

