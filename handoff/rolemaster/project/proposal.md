# Curator Portal Redesign — Proposal

*Draft 2026-05-03. Author: Rachel, in conversation with Claude. Pending implementation.*

This proposal redesigns the curator surface (S6 → S7 → S8) of the RoleMaster prototype to match how the curator team actually works: review with AI assistance, call the supplier by phone, paste call notes back in, edit, then hand off to sales. It supersedes the current curator flow defined in `CLAUDE.md` §5 for screens 6–8.

The visual language, chrome, design tokens, and supplier/sales flows defined in `CLAUDE.md` are unchanged. This proposal touches only `screens-other.jsx` (S6, S8 reframing), `screen-workbench.jsx` (S7 — the bulk of the change), `styles.css` (new components only), and `i18n.jsx` (new strings, both locales).

---

## 1 · Why this exists

The current curator surface treats each submission as one-shot — review, publish. The actual curator team:

1. Reads what the supplier submitted
2. Calls the supplier on the phone to clarify gaps
3. After the call, takes the meeting notes and updates the submission
4. Hands the cleaned-up RolePack to sales

There is **no async chat** with the supplier — clarification happens by phone, intentionally. The redesign reflects that workflow, adds AI assistance at the right moments, and supports a 15+ curator team with a lead role.

---

## 2 · Lifecycle

The submission moves through four pipeline phases plus an archive:

```
New  →  Review  →  Discussion  →  Finalize  →  Published (archive)
```

Phase gates are **soft**: a curator can paste call notes or edit fields whether or not the phase indicator says "Discussion" or "Finalize." The phase reflects the latest event, not a hard barrier. There is intentionally no "awaiting supplier" or "supplier replied" state — all back-and-forth happens by phone.

---

## 3 · Roles

| Role | Capabilities |
|---|---|
| **Curator** | Works their own queue. Opens any submission assigned to them, runs the workbench, edits, advances phases, hands off to sales. |
| **Lead** | All curator capabilities, plus the Team view toggle on the inbox, drag-to-assign, observe-mode access to any workbench. |

Role is per-account and gates the UI: non-leads never see the Team-view toggle.

---

## 4 · S6 · Inbox redesign

The inbox shifts from a flat queue to a **stage kanban** with two complementary lenses (kanban / supplier groups) and a lead-only **scope toggle** (My queue / Team view).

### 4.1 Header

Left to right:

```
[ View: Kanban | Supplier groups ]   [ Scope: My queue | Team view ]*   [ filters: industry · supplier · age · assignee ]   [ search ]
```

`* lead-only`

### 4.2 Stage kanban (default view)

Four active columns plus a collapsed Published archive:

```
┌──────────┬────────────┬──────────────┬────────────┬─────┐
│   New    │   Review   │  Discussion  │  Finalize  │ ▶ Published │
└──────────┴────────────┴──────────────┴────────────┴─────┘
```

**Card anatomy:**

```
┌──────────────────────────────────┐
│ Vigil Advisory · TMX             │
│ AML transaction monitor          │
│ 12 capabilities · submitted 4d   │
│                                  │
│ 📞 Tue May 12       [ Mei C. ]   │  ← Discussion column only: call date + assignee
└──────────────────────────────────┘
```

**Discussion-column card states:**

- *Pre-call*: normal card
- *On call-day*: soft purple pulse + phone icon
- *Day after call onward*: yellow "📝 Notes pending" chip, card bubbles to top of column
- *3+ days post-call*: chip turns orange (gentle nudge, no block)

**Drag interactions:**

- Card → another column = advance/regress phase
- Advancing into *Discussion* prompts a date picker: "When's the call?" (required)
- Advancing into *Published* triggers the existing asset-gen overlay (S8.5)
- (Lead-only, Team view) Card → curator avatar in team-load rail = assign/reassign

### 4.3 Supplier groups view (toggle)

Same data, rolled up by supplier. One row per supplier:

```
▶ Vigil Advisory Limited      3 roles · 14 capabilities    [▰▰▱▱▱]
  ↑ collapsed, expand to see individual submissions       ↑ mini phase bar
```

Mini phase bar shows how many of the supplier's submissions sit in each phase (color matches kanban column). Expand row → table of submissions with stage chip + assignee + age.

### 4.4 Team view (lead only)

Same kanban as 4.2, but:

- Every card shows the assignee avatar (always visible, not on hover)
- **Top strip:** aggregate counters — `24 in review · 11 in discussion · 7 finalizing · avg cycle 4.2 days · oldest item 11 days`
- **Right rail:** Team load — list of curators with item counts and color-banded phase distribution. Click avatar to filter board. Drag card onto avatar to assign.

Lead can enter any workbench in **observe mode** (read-only, no edits, no advance).

---

## 5 · S7 · Workbench redesign

This is the bulk of the work. Layout, top to bottom:

```
┌──────────────────────────────────────────────────────────────┐
│ CuratorHeader (existing)                                     │
├──────────────────────────────────────────────────────────────┤
│ Sub-header: ID · Supplier › Role · status badge · shortcuts  │
├──────────────────────────────────────────────────────────────┤
│ ✦ AI BRIEFING (collapsible)                          [▼]     │  ← NEW
│   3-bullet summary  ·  strong/thin  ·  suggested questions   │
├──────────────────────────────────────────────────────────────┤
│ Phase: ●━━━○━━━○   Review · Discussion · Finalize            │  ← NEW
├──────────────────────────────────────────────────────┬───────┤
│                                                      │       │
│  Form area (existing supplier-S4 layout)             │ Copi- │
│  Read-only or editable depending on phase            │ lot   │
│                                                      │ pane  │
│                                                      │       │
└──────────────────────────────────────────────────────┴───────┘
```

### 5.1 AI Briefing banner *(new)*

Positioned **above** the form, full-width. Default state on first open: expanded. Subsequent opens: collapsed to a one-line teaser ("✦ Briefing · 3 bullets, 5 questions"). Chevron toggles. Keyboard `b` toggles.

Sections:

1. **What is this RolePack** — 3 plain-language bullets ("AML transaction monitor for HK retail banks · auto-flags suspicious wires · deploys in 6 weeks via REST + Snowflake")
2. **Strong / thin** — two compact lists. Strong = fields well-supported by uploads. Thin = fields the AI is worried about (sparse, vague, or missing).
3. **Suggested questions for the call** — 4–6 ready-to-ask questions, each with an arrow chip pointing to the related field. A "Copy all" button at the right copies them as plain text for pasting into a notebook.

**Click-to-jump:** every chip in every section is clickable. Clicking scrolls to and pulses the referenced form field. The "thin" callouts are linked to their fields by default; questions are linked to the fields they reference.

**Regenerable:** a "Re-summarize" button at the top-right re-runs the briefing against the current submission state. Useful after Discussion-mode edits land. Suggested auto-trigger: not automatic. Re-summarize is on demand only — see open questions §9.

### 5.2 Phase indicator *(new)*

Three-step `ProcessStepper` sized down (smaller than the supplier stepper). Phases: Review · Discussion · Finalize.

Curator-driven advancement, soft gates:

- *Review → Discussion*: opens "When's the call?" date picker (required); date attaches to the card
- *Discussion → Finalize*: no prompt
- *Finalize → Publish (S8)*: routes to S8

Click any earlier phase to jump back. Phase state persists per submission.

### 5.3 Form area

Same layout as supplier S4 form. Same field statuses (ai / filled / empty / weak), same status legend chip, same `.field-pulse` animation when Copilot updates fields.

Editability per phase:

| Phase | Form |
|---|---|
| Review | Read-only |
| Discussion | Read-only — edits arrive via diff-accept on the Copilot pane |
| Finalize | Fully editable |

**Audit chip on every field.** Hover any field → small chip appears revealing last edit: `who · source · when`. Three sources tracked:

- `supplier` — original intake from S4
- `copilot-call` — derived from a paste-notes session
- `curator` — direct edit by a curator (chip names them)

### 5.4 Copilot pane *(right, 380px)*

Anatomy unchanged from supplier S4 — same purple ✦ header, white background, white card bubbles with purple ink, sticky composer at bottom. **Contents change per phase:**

#### 5.4.1 Review mode

- Greeting: *"Briefing's at the top. Anything you want to ask me about this submission?"*
- Free chat. Curator can ask grounded questions ("what does TMX integrate with?", "draft 2 more questions about geographic coverage"). Copilot answers from the uploads + form.

#### 5.4.2 Discussion mode

Stacked layout in the pane:

```
┌────────────────────────────────────┐
│ Drop call notes / transcript here  │
│ ┌────────────────────────────────┐ │
│ │                                │ │  ← multi-line paste area
│ │                                │ │
│ └────────────────────────────────┘ │
│              [ Process notes ]     │
├────────────────────────────────────┤
│ ✦ Proposed updates  (after click)  │
│ ☑ pricing.tier                     │
│   "Tier 2" → "Tier 3"              │
│   from notes: "we moved to T3 ..."  │
│ ☑ geo.regions                      │
│   …                                │
│ ☐ deployment.timeline              │
│   …                                │
│                                    │
│ [ Apply 6 changes ]  [ Reject all ]│
└────────────────────────────────────┘
```

**Diff list behavior:** each proposal has a checkbox (pre-checked), field name, current → proposed value, and a quoted source snippet from the pasted notes. Curator unchecks anything they don't want. Bulk apply at bottom. Applied diffs trigger the field-pulse animation in the form, batched (same staging behavior as supplier S4 Copilot fill).

Source attribution on every applied change is automatically `copilot-call`, with the pasted notes archived against the submission for audit.

#### 5.4.3 Finalize mode

- **Audit log scroll** — chronological list of every field change since submission, who/what/when/source. Filterable by source.
- **"Ask Copilot" composer** at the bottom — free chat for last-mile drafting help: tighten copy, translate to zh, expand a bullet, etc.

### 5.5 Keyboard

Existing curator shortcuts preserved (`a` approve, `r` request changes, `⌘+↵` publish). Add:

- `b` — toggle briefing banner
- `p` — advance phase forward (with prompts where applicable)

---

## 6 · S8 · Publish

No structural change. Reframe copy from "publish" to "hand off to sales." The asset-generation overlay (S8.5) and the auto-route to sales catalog after generation are unchanged.

---

## 7 · Visual language

Mirrors the supplier module exactly, re-themed in curator purple. No new tokens.

- `PlatformHeader` with BrandMark + curator pill + accent hairline (purple)
- Field statuses (ai / filled / empty / weak) with the same colors and pulse animation
- Copilot pane: white bg, purple ✦ icon, white card bubbles with purple ink, sticky composer
- `ProcessStepper` reused for the phase indicator
- All density / roundness / font / warmth options from the Tweaks panel honored
- Bilingual zh/en — every new string added to `i18n.jsx` in both locales

---

## 8 · Audit trail

Per-field edit record (illustrative shape):

```js
{
  field: "pricing.tier",
  previousValue: "Tier 2",
  value: "Tier 3",
  editedBy: { id: "curator-mei", name: "Mei Chan" },
  source: "copilot-call",         // supplier | copilot-call | curator
  notesRef: "call-2026-05-12",    // present when source = copilot-call
  timestamp: "2026-05-13T10:24:00Z"
}
```

Two surfaces consume the audit:

- Hover chip on any form field — last edit only
- Audit log in the Finalize-mode Copilot pane — full history, filterable

The pasted call notes themselves are stored against the submission keyed by `notesRef` so a future curator can re-open them.

---

## 9 · Open questions

1. **Notifications.** Do curators get a desktop / email ping when assigned, or only see it on the kanban? Affects whether we need a notification model at all.
2. **Re-summarize cadence.** Briefing is on-demand only in this proposal. Worth considering: auto-regenerate after a Discussion-phase apply.
3. **Published archive permissions.** Read-only for everyone, or editable by leads (corrections after the fact)?
4. **Supplier visibility.** Does the supplier ever see anything change after they submit? Assumption here: no, submission is frozen post-submit. Confirm.
5. **Multiple discussions per submission.** Today the design assumes one call. Edge case: a second call after Finalize. Current proposal handles this by letting curator regress to Discussion phase, paste new notes, and the audit log accumulates.

---

## 10 · Out of scope (this proposal)

- Async messaging with the supplier — intentionally phone-only
- Mobile workbench layout
- Version history beyond per-field "last edit"
- Curator self-service settings (timezone, notification prefs, profile photo)
- Rich performance analytics — lead Team view shows the basics only
- Migration of existing in-flight submissions — handled by data layer, not UI

---

## 11 · Implementation note

Files touched:

| File | What changes |
|---|---|
| `screens-other.jsx` | Replace S6 inbox with stage kanban + supplier-groups + team-view toggle. Reframe S8 copy. |
| `screen-workbench.jsx` | Add briefing banner, phase indicator, phase-aware Copilot pane (Review chat / Discussion paste+diff / Finalize audit). Wire field-edit audit trail. |
| `styles.css` | New: kanban column + card styles; briefing banner; team-load rail; audit chip; diff-list rows. |
| `i18n.jsx` | New strings for briefing, phase labels, kanban columns, diff-list, audit log, lead-only labels — both `zh` and `en`. |
| `data.jsx` | Extend `WORKBENCH_FIELDS` with audit history shape; extend `QUEUE` with phase, assignee, callDate fields. |
| `chrome.jsx` | No changes. |

Rough effort estimate: 3–4 days for one developer comfortable with the prototype, plus a half-day pass on bilingual strings.

---

*End of proposal. Review, mark up, then implementation begins.*
