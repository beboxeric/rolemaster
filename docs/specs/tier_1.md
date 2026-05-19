# RoleMaster Engineering Spec — Tier 1

> **Context:** This is one tier of the RoleMaster Engineering Spec. The full spec is split across 5 tier files plus README and notes. Refer to the README for shared conventions, repository structure, and ship order.

> **How to use this:** Each ticket is self-contained. Pick one ticket, read it fully, implement it, ship it. Verify against the manual verification steps. Then move to the next.

---

# Tier 1 — Close the curator workbench gap

The workbench is the platform's quality moat. Right now it renders Vigil sample data regardless of which submission is open. Tickets T1.1 through T1.5 replace that with real, per-submission AI-generated content.

---

## Ticket T1.1 — Schema for three-layer atoms and generated content

**Why:** The workbench needs to display capabilities (能力), knowledge (知识), and interfaces (接口) extracted from each submission. Currently these are hardcoded in `data.js`. Add tables to store them per submission.

**Scope:**

1. Add three new tables to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS layer_atoms (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('capability', 'knowledge', 'interface')),
  atom_id TEXT NOT NULL,           -- e.g. "CAP-01", "KNW-03", "INF-02"
  name_zh TEXT,
  name_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  source_quote TEXT,               -- the supplier-provided text the AI extracted from
  confidence REAL,                 -- 0.0 to 1.0, AI-reported
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  edited_by TEXT,                  -- curator user id if edited
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX idx_layer_atoms_submission ON layer_atoms(submission_id, layer);

CREATE TABLE IF NOT EXISTS submission_generated (
  submission_id TEXT PRIMARY KEY,
  customer_voice_pain_zh TEXT,
  customer_voice_pain_en TEXT,
  value_positioning_zh TEXT,
  value_positioning_en TEXT,
  capability_summary_zh TEXT,
  capability_summary_en TEXT,
  one_liner_zh TEXT,
  one_liner_en TEXT,
  ai_assembly_recommendation_zh TEXT,
  ai_assembly_recommendation_en TEXT,
  ai_assembly_alternatives_json TEXT,  -- JSON array of {name, reasoning}
  generated_at INTEGER,
  generated_by TEXT,                    -- 'auto' or curator user id
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales_materials_draft (
  submission_id TEXT PRIMARY KEY,
  pitch_outline_json TEXT,         -- JSON: array of slide objects {title, bullets[]}
  faq_json TEXT,                   -- JSON: array of {q, a} pairs in zh/en
  elevator_pitch_zh TEXT,
  elevator_pitch_en TEXT,
  discovery_questions_json TEXT,   -- JSON: array of {q_zh, q_en}
  generated_at INTEGER,
  edited_at INTEGER,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
```

2. Apply locally: `wrangler d1 execute rolemaster-db --local --file=schema.sql`
3. Apply to remote: `wrangler d1 execute rolemaster-db --remote --file=schema.sql`

**Files touched:** `schema.sql`

**Acceptance:**
- Tables exist in local and remote D1
- `wrangler d1 execute rolemaster-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"` shows the three new tables
- No data migration needed (existing submissions don't yet have generated content; will be populated by T1.2)

**Dependencies:** none

---

## Ticket T1.2 — AI extraction endpoint: three-layer decomposition + generated content

**Why:** When a supplier submits, we need to run an AI pass that decomposes their submission into capabilities/knowledge/interfaces and generates customer-voice content. Currently this never happens — workbench shows hardcoded sample data.

**Scope:**

Create `functions/api/submissions/[id]/decompose.js`:

- **Method:** POST
- **Auth:** curator only (check `user.role === 'curator'`)
- **Input:** none beyond the submission ID in URL
- **Behavior:**
  1. Load the submission and all `submission_fields` for it
  2. Build a Claude prompt (see prompt template below) including all field values
  3. Call Claude (`claude-sonnet-4-6` as used elsewhere) with strict JSON output requested
  4. Parse the response; expect this shape:

```json
{
  "capabilities": [
    { "atom_id": "CAP-01", "name_zh": "...", "name_en": "...", "description_zh": "...", "description_en": "...", "source_quote": "...", "confidence": 0.92 }
  ],
  "knowledge": [ /* same shape, atom_id KNW-NN */ ],
  "interfaces": [ /* same shape, atom_id INF-NN */ ],
  "generated": {
    "customer_voice_pain_zh": "...",
    "customer_voice_pain_en": "...",
    "value_positioning_zh": "...",
    "value_positioning_en": "...",
    "capability_summary_zh": "...",
    "capability_summary_en": "...",
    "one_liner_zh": "...",
    "one_liner_en": "..."
  },
  "ai_recommendation": {
    "preferred_assembly": "single_rolepack" | "split_into_n",
    "n": 1 | 2 | 3,
    "rolepack_proposals": [
      { "name_zh": "...", "name_en": "...", "rationale_zh": "...", "rationale_en": "...", "atom_ids": ["CAP-01", "CAP-02", "KNW-01", "INF-01"] }
    ],
    "alternatives": [
      { "label_zh": "合并为 1 个", "label_en": "Merge into 1", "reasoning_zh": "...", "reasoning_en": "..." }
    ]
  }
}
```

  5. Wipe any existing rows in `layer_atoms` for this submission (this is a re-decompose; manual edits may be lost — that's accepted, see T1.3 for re-run behavior)
  6. Insert all atoms into `layer_atoms`
  7. UPSERT generated content into `submission_generated`
  8. Return `{ ok: true, atom_count: N, generated: {...} }`
- **Error handling:**
  - If `ANTHROPIC_API_KEY` missing: return `{ ok: false, reason: 'no_api_key' }` with status 200 (per `prefill.js` convention)
  - If Claude returns invalid JSON: log to `audit_log`, return `{ ok: false, reason: 'invalid_response' }`
  - If submission empty (no fields with values): return `{ ok: false, reason: 'submission_empty' }`

**Prompt template (in English; Claude responds in both languages):**

```
You are RoleMaster's curation AI. A supplier has submitted product information. 
Your job: decompose it into our three-layer model and generate sales-ready content.

The three layers (this is OUR internal taxonomy, never shown to suppliers):
- Capabilities (能力): atomic actions the product performs (e.g., "OCR document", "screen sanctions list")
- Knowledge (知识): embedded business logic, SOPs, rules, regulatory frameworks
- Interfaces (接口): external systems the product connects to (e.g., SWIFT, WeChat, Salesforce)

For each atom you identify, give it an ID (CAP-01, KNW-01, INF-01, incrementing per layer), 
a short name (3-8 words) in both Chinese and English, a one-sentence description in both 
languages, the supplier's exact quote that you extracted it from, and a confidence score.

Then generate four pieces of customer-facing content:
- customer_voice_pain: 2-3 sentences in the customer persona's own voice. Not marketing copy. 
  Reference concrete tools and numbers if the supplier provided them.
- value_positioning: 1-2 sentences stating what the product delivers, who for, and why it matters.
- capability_summary: 5-8 bullet points of what the product does, written for a generalist sales rep.
- one_liner: ≤140 characters, the elevator pitch.

Finally, recommend RolePack assembly:
- If the product serves one persona end-to-end with a coherent story, recommend a single RolePack.
- If the product spans multiple distinct personas or workflows, recommend splitting into N RolePacks.
- Always provide 1-2 alternatives with reasoning.

Output strict JSON matching the schema. No markdown fences. No prose outside the JSON.

Submission data:
[INSERT FORMATTED FIELD VALUES HERE]
```

**Files touched:**
- New: `functions/api/submissions/[id]/decompose.js`

**Manual verification:**
1. With `ANTHROPIC_API_KEY` unset, POST to `/api/submissions/{id}/decompose` → returns `{ ok: false, reason: 'no_api_key' }`
2. With key set, POST against a real submission → returns `{ ok: true, atom_count: N }` with N > 0
3. Query D1: `SELECT layer, COUNT(*) FROM layer_atoms WHERE submission_id = ? GROUP BY layer` shows three rows
4. Query D1: `SELECT * FROM submission_generated WHERE submission_id = ?` shows generated content
5. Run the same submission twice → second run replaces atoms, doesn't accumulate

**Dependencies:** T1.1

---

## Ticket T1.3 — Auto-trigger decomposition when a supplier submits

**Why:** Curator should never need to manually trigger decomposition. The moment a submission flips from `draft` to `new` (the supplier hits Submit), we kick off T1.2's endpoint.

**Scope:**

In `functions/api/submissions/[id]/submit.js`:
- After flipping status to `new` and writing the audit log entry, call the decomposition logic.
- For Cloudflare Pages Functions: call it inline (no queue infrastructure available). Decomposition takes 5-15 seconds; the supplier is shown a "submitting..." spinner that tolerates this.
- If decomposition fails, status still flips to `new` (don't block the supplier). Log the failure to `audit_log` with action `decompose_failed`.

In the supplier-facing thank-you screen (`app/src/screens/other.jsx::ScreenThanks`):
- After submit POST returns, show "AI 正在整理您的产品信息... / AI is organizing your product info..." for up to 20 seconds with a spinner
- This is friendly cover for the inline decomposition latency

**Files touched:**
- `functions/api/submissions/[id]/submit.js` (extend)
- `app/src/screens/other.jsx` (ScreenThanks)
- `app/src/i18n.js` (add 2 strings)

**Acceptance:**
- Submitting a draft → backend calls decompose internally → curator workbench (T1.4) immediately shows real layer atoms when opened
- If decomposition fails, supplier still lands on thanks screen (no error shown to them); curator sees the failure in audit log
- A second decompose can be manually re-triggered from the curator workbench (T1.4 includes a button)

**Dependencies:** T1.2

---

## Ticket T1.4 — Workbench reads real layer atoms and AI recommendation

**Why:** Replace hardcoded `LAYERS`, `AI_REC` from `data.js` with real per-submission data.

**Scope:**

Backend — extend `functions/api/submissions/[id]/index.js` (GET handler) to include:
- `layer_atoms`: array grouped by layer
- `generated`: the row from `submission_generated`
- `decompose_status`: `null` | `'pending'` | `'done'` | `'failed'` (derived from presence of rows + audit log)
- Add a new endpoint: `POST /api/submissions/[id]/decompose` (already created in T1.2) — usable by curator from the workbench to re-run

Frontend — `app/src/screens/workbench.jsx`:

1. Remove imports of `LAYERS`, `AI_REC`, `SALES` from `data.js`. Workbench must rely entirely on what the API returns.
2. The center pane "三层拆解" section now reads `submission.layer_atoms`. Render each layer in its own colored card with the atom rows beneath. Atom rows show: ID, name, description, confidence indicator (e.g., dot color: green ≥0.85, yellow ≥0.6, red below).
3. Each atom is editable inline: clicking a row opens a small inline form with name and description fields (zh + en), Save/Cancel. On Save, PATCH `/api/submissions/[id]/atoms/[atomId]` (new endpoint, see below).
4. Add atom: button at bottom of each layer card, opens the same inline form blank. POST `/api/submissions/[id]/atoms`.
5. Delete atom: each row has a trash icon, confirmation prompt, DELETE `/api/submissions/[id]/atoms/[atomId]`.
6. The AI recommendation section reads `submission.generated.ai_assembly_*` and `ai_assembly_alternatives_json`. Display the AI-recommended structure in a purple-bordered card; alternatives below in lighter cards. Curator picks one with a radio.
7. Re-run decomposition: a button in the workbench header "🔄 重新分析 / Re-analyze". Confirmation prompt warns that manual atom edits will be lost. POST `/api/submissions/[id]/decompose`.

New backend endpoints:
- `POST /api/submissions/[id]/atoms` — body: `{ layer, name_zh, name_en, description_zh, description_en }`. Curator only.
- `PATCH /api/submissions/[id]/atoms/[atomId]` — partial update. Curator only.
- `DELETE /api/submissions/[id]/atoms/[atomId]` — curator only.

All three log to `audit_log`.

**Files touched:**
- `functions/api/submissions/[id]/index.js` (extend GET)
- New: `functions/api/submissions/[id]/atoms.js` (POST handler)
- New: `functions/api/submissions/[id]/atoms/[atomId].js` (PATCH, DELETE)
- `app/src/screens/workbench.jsx` (substantial rewrite of layer/recommendation sections)
- `app/src/api.js` (add atom helpers)
- `app/src/i18n.js` (add 12-15 strings for new buttons/prompts)

**Manual verification:**
1. Submit a draft as a supplier → wait for decompose to finish (~10 sec)
2. As curator, open the submission in workbench → see real atoms grouped by layer
3. Edit an atom name → reload page → edit persists
4. Add an atom → it appears
5. Delete an atom → confirmation → it's gone
6. Click "Re-analyze" → atoms regenerate (manual edits lost — expected)
7. Switch language (zh/en) → all atom names and descriptions follow

**Dependencies:** T1.2, T1.3

---

## Ticket T1.5 — Workbench: real auto-generated sales materials drafts

**Why:** The workbench currently shows hardcoded FAQ, pitch outline, and 30-second script regardless of submission. Generate real ones.

**Scope:**

Create `functions/api/submissions/[id]/generate-materials.js`:
- POST. Curator only.
- Reads the submission + its layer_atoms + submission_generated
- Calls Claude with a prompt that produces:
  - `pitch_outline_json`: 5-7 slide outlines (each with title, 3-5 bullets, both languages)
  - `faq_json`: 10-12 Q&A pairs (typical customer questions, both languages)
  - `elevator_pitch_zh` / `elevator_pitch_en`: ≤80 words
  - `discovery_questions_json`: 5-8 questions for sales reps to ask prospects
- UPSERT into `sales_materials_draft`
- Returns the generated content

Auto-trigger: this endpoint runs automatically right after T1.2's decomposition completes (chained inside `submit.js`). So by the time curator opens the workbench, materials drafts are ready alongside layers.

In `workbench.jsx`:
- Replace the hardcoded `SALES` data import with reading from API
- Show the four asset previews (pitch outline as collapsible slide list; FAQ as accordion; elevator pitch as a single block; discovery questions as a list)
- Each is editable inline; edits save to `sales_materials_draft` via PATCH `/api/submissions/[id]/materials`
- "🔄 重新生成此项 / Regenerate this section" button on each block — calls `generate-materials.js` with a `?only=pitch_outline|faq|elevator|discovery` query parameter (regenerate-one-section flag)

**Files touched:**
- New: `functions/api/submissions/[id]/generate-materials.js`
- New: `functions/api/submissions/[id]/materials.js` (PATCH for inline edits)
- `functions/api/submissions/[id]/submit.js` (chain after decompose)
- `functions/api/submissions/[id]/index.js` (include `materials` in GET)
- `app/src/screens/workbench.jsx`
- `app/src/i18n.js`

**Manual verification:**
1. Submit a fresh draft as supplier → wait for decompose + generate-materials to chain (~20-25 sec)
2. As curator, open workbench → all four asset previews show real, contextually relevant content
3. Edit the elevator pitch → reload → edit persists
4. Click "Regenerate FAQ" → only the FAQ section changes; other edited sections preserved

**Dependencies:** T1.2, T1.3, T1.4

---

