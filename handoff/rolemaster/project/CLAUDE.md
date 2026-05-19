# RoleMaster Prototype — Handoff to Claude Code

This document is the **single source of truth** for tightening this prototype to production-grade. Read this end-to-end before touching any code. The prototype already encodes the design decisions; your job is to tighten fidelity, fix gaps, and verify each change against the running app.

---

## 0 · Working agreement (read this first)

**You are tightening, not redesigning.** The prototype's visual language, IA, and interaction patterns are settled. Do not invent new colors, change layouts unilaterally, or add screens. If you think a design change is warranted, write a `proposal.md` and stop — don't ship it.

**Verify after every change.** Open the file in a browser, click through the affected screen, and confirm the change matches what's described in this doc. If you can't visually confirm, you haven't finished. The "verification loop" section below is mandatory.

**Close the gap, don't widen it.** Every PR/commit should reduce the delta between what's in code and what's in this spec. If you find an inconsistency, fix it; if you can't, log it in `gaps.md` with a screenshot.

---

## 1 · What this prototype is

RoleMaster is a three-sided platform for packaging AI consulting expertise into reusable, sellable units called **RolePacks**. Three user surfaces:

| Platform | Who | Color | Job |
|---|---|---|---|
| **Supplier** | AI consulting firms (e.g. Vigil Advisory) | Soft green `#6FA577` | Submit a RolePack: register → upload materials → identify products → fill intake form → confirm → submit |
| **Curator** | RoleMaster internal review team | Soft purple `#8E7AB5` | Inbox → workbench review → publish |
| **Sales** | RoleMaster sales agents | Soft blue `#6E9CC9` | Sign in → browse catalog → open RolePack detail to pitch |

11 screens total, all in a single SPA, switched by a screen-picker dock at the bottom.

---

## 2 · File map

```
RoleMaster Prototype.html         ← entry point. Loads everything below.
RoleMaster Prototype (standalone).html  ← bundled output. DO NOT EDIT — regenerate.

styles.css                        ← all CSS. Tokens at top, components below.
i18n.jsx                          ← bilingual strings (zh + en). window.STRINGS.
data.jsx                          ← sample data. window.SUPPLIER, window.PROD..., window.ROLEPACKS, etc.
tweaks-panel.jsx                  ← starter component for the Tweaks panel. Don't edit.

chrome.jsx                        ← shared chrome: SCREENS registry, PlatformHeader,
                                    PlatformPill, BrandMark, ScreenPicker,
                                    ProcessStepper, getPlatformSteps, LangSwitcher.

screens-onboard.jsx               ← S1 Register, S2 Upload, S3 Multi-product
screen-form.jsx                   ← S4 Intake form + Copilot (CENTERPIECE)
screens-other.jsx                 ← S5a Confirm modal, S5b Thanks, S6 Queue, S8 Publish
screen-workbench.jsx              ← S7 Curator workbench (SECOND PILLAR)
screens-sales.jsx                 ← S9 Sign in, S10 Catalog, S11 RolePack detail,
                                    AssetGenerationOverlay (between S8→S11)
```

Every JSX file uses `<script type="text/babel">` with **its own** `useState/useEffect` aliases (`uS1`, `uS4`, `uS5`, etc.) to avoid Babel global collisions across files. Preserve this pattern. Components are exported to `window.*` at the bottom of each file.

---

## 3 · Design tokens (don't drift from these)

### 3.1 Platform colors (live values, set on `<html>` by App)

```
--plat-supplier      : #6FA577  /* soft green */
--plat-supplier-2    : shade(supplier, 0.18)   ← darker, for hover/text on tint
--plat-supplier-tint : tint(supplier, 0.92)    ← page bg

--plat-curator       : #8E7AB5  /* soft purple */
--plat-curator-2     : shade(curator, 0.18)
--plat-curator-tint  : tint(curator, 0.92)

--plat-sales         : #6E9CC9  /* soft blue */
--plat-sales-2       : shade(sales, 0.18)
--plat-sales-tint    : tint(sales, 0.92)
```

These are **user-tweakable** at runtime via the Tweaks panel. The `tint()` and `shade()` helpers in `RoleMaster Prototype.html` derive `-2` and `-tint` automatically, so always change the base — never hardcode the derivatives.

### 3.2 Theme tokens (legacy themes for the supplier surface)

`<html data-theme="powder">` (default). Six themes defined in `styles.css` lines 4–104: **powder, sage, blush, sand, lavender, mist**. Each sets `--primary`, `--primary-2`, `--primary-deep`, `--primary-soft`, `--primary-tint`, `--primary-line`, `--bg`, `--bg-2`. Don't add more themes; the platform colors above are now the primary identity system.

### 3.3 Semantic field statuses (form intake on S4)

```
--st-ai-bg/border/ink        : pale blue   — "AI extracted"
--st-fill-bg/border/ink      : pale green  — "user confirmed"
--st-empty-bg/border/ink     : pale orange — "needs input"
--st-weak-bg/border/ink      : pale yellow — "thin, please expand"
```

These are theme-independent and must stay readable on both warm and cool backgrounds. **Don't replace them with platform colors.**

### 3.4 Copilot palette (used on S4 + S7 Copilot pane)

```
--cop-border  : #6B3FA0   /* purple */
--cop-bg      : #F5EFFA   /* (DEPRECATED — pane is now white) */
--cop-bubble  : #EDE3F7   /* (DEPRECATED — bot bubbles are now white w/ purple text) */
--cop-ink     : #4A2A78   /* purple text — keep using this for Copilot copy */
```

Copilot pane currently uses **white background with purple text**. The bubble bot style: `background: white; color: var(--cop-ink); border: 1px solid #E5DAF1;`. Keep it that way.

### 3.5 Geometry, type, density (tweakable)

```
--radius-sm: 6px;  --radius: 10px;  --radius-lg: 16px;
--r-sm / --r-md / --r-lg / --r-pill   ← per-roundness-mode (sharp | soft | pill)

--d-pad / --d-gap                      ← per-density-mode (compact | normal | comfortable)

--font-sans                            ← Inter (default), IBM Plex Sans, Source Serif 4, system-ui
--font-mono                            ← JetBrains Mono
```

If you add a new spacing or radius, add a token. **No magic numbers.**

---

## 4 · Component anatomy

### 4.1 `PlatformHeader` (chrome.jsx)

The unified header used by **all three platforms**. Anatomy left → right:

```
[BrandMark R] [RoleMaster] [PlatformPill]   |   [contextLabel/savedAt/nav]   |   [right slot]
```

- BrandMark and accent line (1px under header) take their color from `--plat-color`, which is set by the `platform-header-{supplier|curator|sales}` class on the `<header>`.
- PlatformPill is a solid-fill capsule colored with `--plat-color`, white text. Says "供应商/Supplier", "策展人/Curator", "销售/Sales".
- Right slot holds: language switcher always; supplier also shows save status + product label; curator shows nav-links (Submissions / Curators / Approved / Settings); sales shows sign out.

**Never add an ad-hoc header.** S1–S3 used to have hand-rolled gold-line headers; those are gone. New screens must use `<AppHeader>`, `<CuratorHeader>`, or `<SalesHeader>`.

### 4.2 `ProcessStepper` (chrome.jsx)

Timeline with dot + label per step, connector line filled in for completed steps. Auto-derives current step from `currentScreen` and the array returned by `getPlatformSteps(platform, lang)`. Click any **completed** step to jump back.

**Sales platform: stepper is hidden.** This is intentional (sales is a browse-not-flow surface). The condition is in `RoleMaster Prototype.html`:
```js
{tweaks.showStepper && platform && platform !== "sales" && (
  <ProcessStepper ... />
)}
```
Don't reintroduce it for sales.

Supplier steps: Register · Upload · Identify · Fill form · Submit
Curator steps: Inbox · Review · Publish

### 4.3 Body wrappers (`platform-supplier|curator|sales`)

Every screen's outermost div has `className="platform-{X}"`. This:
- Sets the page background to the platform tint
- Scopes `--primary` (and CTAs / accents) to the platform color **inside that screen**

So a `.btn-primary` on the supplier side is green, on curator purple, on sales blue. **All buttons that should follow platform should use `var(--primary)`**, not the platform variable directly.

### 4.4 Form fields with status (S4)

Fields render `<input class="field-input {status}">` where status ∈ `{ai, filled, empty, weak}`. The status drives both background/border (semantic colors) and the legend chip beside the label. Pulse animation `.field-pulse` plays for ~1.4s when Copilot updates a field — staged so all batch-updates pulse simultaneously, not sequentially. See `screen-form.jsx` `handleCopilotFill`.

### 4.5 Copilot pane (S4)

Right column on S4, 380px wide, white background. Header strip (purple ✦ icon + "Copilot"), scrolling message list, sticky composer at bottom. Bot bubbles: white card, purple text, soft purple border. User bubbles: green tint (platform-supplier color), right-aligned. **System messages** (Copilot updated N fields): centered, small caps, muted.

### 4.6 RolePack detail (S11) — section order

1. Hero: ID line · name · italic pitch (gold left-rule) · industry tags
2. **Materials + Quick Facts** (two-column grid: 1.2fr / 1fr)
3. **Overview** (added 2024-12) — descriptive paragraph in white card
4. **The Customer's Pain** (italic blockquote, white card)
5. **The Outcome** (bullet list + proof callout)
6. Capabilities, Prerequisites, Deployment, Pricing
7. Sticky CTA bar at bottom

Only RP-AML has `hasFullData` in `data.jsx`; other 8 RolePacks render the hero + materials only and a "more details coming soon" stub. Keep that gating logic.

---

## 5 · Screens (1–11)

| # | Screen | File | Platform | Notes |
|---|---|---|---|---|
| 1 | Register | screens-onboard.jsx | Supplier | Hero card, soft visuals |
| 2 | Upload | screens-onboard.jsx | Supplier | Drag-drop, file thumbnails, parse progress |
| 3 | Multi-product | screens-onboard.jsx | Supplier | Identified candidate products, user picks one |
| 4 | **Intake + Copilot** | screen-form.jsx | Supplier | THE CENTERPIECE — get this perfect |
| 5a | Confirm modal | screens-other.jsx | Supplier | Floats over S4. Diff summary, confirm or back |
| 5b | Thanks | screens-other.jsx | Supplier | Submitted screen, status timeline |
| 6 | Curator inbox | screens-other.jsx | Curator | Submission queue, filterable |
| 7 | **Curator workbench** | screen-workbench.jsx | Curator | THE SECOND PILLAR — split-pane review w/ Copilot |
| 8 | Publish | screens-other.jsx | Curator | Final review, publish button → asset gen overlay |
| 8.5 | Asset gen overlay | screens-sales.jsx | (overlay) | Animated stepper: building deck, manual, etc |
| 9 | Sales sign in | screens-sales.jsx | Sales | Soft hero, demo password "demo" |
| 10 | Catalog | screens-sales.jsx | Sales | 9 RolePack cards, industry filter, search |
| 11 | RolePack detail | screens-sales.jsx | Sales | See §4.6 |

Keyboard shortcuts (active when no input is focused): `1`–`9` jump to S1–S9, `0` jumps to S9 sign-in. Don't break this.

---

## 6 · Bilingual rules

Every UI string lives in `i18n.jsx`. Use `window.t(key, lang, vars?)`. Two locales:
- `zh` (default) — Simplified Chinese
- `en` — English

User-typed values in form fields are preserved across language switches; only labels/placeholders/help text swap. Sample data in `data.jsx` carries `{zh, en}` shape for any user-facing field.

When you add a new string: add **both** locales, in the same order as existing keys (alphabetical-ish within each section). If you see a `[missing: foo]` in the UI, that's the fallback from `t()` — search for the key and add it.

**Don't translate brand names** (RoleMaster, Vigil, Copilot stays "Copilot" in both locales).

---

## 7 · Tweaks panel (live customization)

Bottom-right floating panel. Toggled by the host toolbar. Sections:

1. **Platform colors** — three color pickers (supplier/curator/sales). Persist across reloads via the `EDITMODE-BEGIN` block in `RoleMaster Prototype.html`.
2. **Appearance** — density, roundness, warmth, font (4 options).
3. **Demo** — show stepper toggle, show screen picker toggle, default language.

The `useTweaks(defaults)` hook returns `[values, setTweak]`. `setTweak('key', value)` posts to host AND updates local state. **Use the destructured form**, never `tweaks.set(...)` — that was a bug we fixed.

---

## 8 · Tightening checklist (do these in order)

### 8.1 Visual consistency sweep
- [ ] Every screen uses `PlatformHeader` (or its `AppHeader`/`CuratorHeader`/`SalesHeader` wrappers). No raw `<header>` elements outside chrome.jsx.
- [ ] Every screen body opens with `<div className="platform-{supplier|curator|sales}">`. Grep for screen components missing this — they'll show wrong tint and wrong CTA color.
- [ ] No hardcoded hex colors in component files (search: `#[0-9A-Fa-f]{3,6}`). Every color must come from a CSS variable. Field-status legend chips and tag colors are exceptions; flag any others in `gaps.md`.
- [ ] All buttons use `.btn .btn-primary` / `.btn-secondary` / `.btn-ghost`. No inline-styled buttons that don't follow the system.
- [ ] All cards use the same shadow/border treatment: `1px solid var(--line); border-radius: var(--radius); background: var(--surface);` — flag exceptions.

### 8.2 Header parity
- [ ] BrandMark color matches platform color on every screen.
- [ ] Accent hairline under header is platform color, 1px, 0.9 opacity.
- [ ] Pill text never wraps (white-space: nowrap is set; verify at narrow widths).
- [ ] LangSwitcher is present on every screen, far right.

### 8.3 Stepper
- [ ] Stepper renders on supplier S1–S5b and curator S6–S8.
- [ ] Stepper is **hidden** on sales S9–S11.
- [ ] Current step's dot has the platform-color halo (`box-shadow: 0 0 0 4px color-mix(...)`).
- [ ] Completed steps show a checkmark, not a number.
- [ ] Clicking a completed step jumps back; clicking a future step does nothing (cursor stays default).

### 8.4 Form (S4)
- [ ] Each field's status pill matches its background tint.
- [ ] Pulse animation triggers all updated fields **simultaneously**, not in sequence.
- [ ] Copilot pane is white bg, purple text. Bot bubbles are white cards w/ purple text + soft purple border.
- [ ] User bubbles use platform-supplier (green) tint, not navy.
- [ ] Composer textarea is white inside a white-card container with rounded corners.
- [ ] Field link chips inside Copilot bubbles are clickable and scroll the form to that field.

### 8.5 Workbench (S7)
- [ ] Three-pane layout: form (with status legend) · diff/comments · Copilot.
- [ ] Field highlights: yellow for "weak/needs work", green for approved, blue for "AI extracted with confidence".
- [ ] Copilot here is **the curator's** Copilot (suggesting next moves), not the supplier's. Distinct copy.

### 8.6 Sales
- [ ] Catalog uses 3-up grid on wide screens, 2-up at midsize, 1-up on narrow.
- [ ] Industry tags use `.ind-{banking|svf|securities|insurance|...}` class for distinct soft-color chips.
- [ ] Detail page Section order: Hero → Materials+Facts → **Overview** → Pain → Outcome → Capabilities → Prereqs → Deployment → Pricing → Sticky CTA.
- [ ] Asset cards (PPT, PDF) have icon, title, "N slides · X MB" subtitle, download arrow on right.
- [ ] Sticky CTA bar at bottom of detail page: "Request demo" primary + "Save to favorites" secondary.

### 8.7 Asset generation overlay (8.5)
- [ ] Plays after curator clicks Publish on S8.
- [ ] Shows step-by-step generation: "Generating pitch deck (7 slides)…", "Building product manual (4 pages)…", etc.
- [ ] Each step ticks to ✓ in sequence with a soft progress bar.
- [ ] On completion, auto-routes to S11 (rolepack detail) with `RP-AML` selected.

### 8.8 Bilingual
- [ ] Switch to `en` and walk every screen. Any Chinese characters that aren't user-input or brand names = bug.
- [ ] Switch to `zh` and walk every screen. Any English (other than brand names + intentional CJK-EN mix in compliance labels like "HKMA, MAS") = bug.
- [ ] Date/time formatting: zh uses `2024年12月15日`, en uses `Dec 15, 2024`. Check timestamps in queue and detail pages.

### 8.9 Accessibility
- [ ] All interactive elements have `:focus-visible` outline.
- [ ] Form inputs have `aria-label` or associated `<label>`.
- [ ] Color is never the only signal — every status tint also has an icon or label.
- [ ] Tab order is logical on every screen.

---

## 9 · Verification loop (mandatory after every change)

After EVERY change, in this order:

1. **Reload `RoleMaster Prototype.html`.** Open DevTools console — must be **zero errors and zero warnings**. Treat any new warning as a regression.
2. **Walk the affected flow.** If you changed S4, walk S1→S2→S3→S4→S5a→S5b. Don't just spot-check.
3. **Both languages.** Toggle ZH/EN at least once in the affected flow.
4. **Both extreme tweaks.** Density compact + roundness sharp, then density comfy + roundness pill. The change should still look right.
5. **Take a before/after screenshot** if visual. Diff them mentally — does the change match this spec?

If any of these fail, **revert and re-think**. Don't ship a half-fix.

After a batch of related changes:

- Run through the full 11-screen click-through using the bottom dock.
- Regenerate the standalone bundle (see §11).
- Update `gaps.md` with anything you noticed but didn't fix.

---

## 10 · Common pitfalls (don't repeat these)

1. **Hardcoded navy.** The original brief said navy `#1F3A5F`. There is no navy anywhere now. If you see `#1F3A5F` or `#2D3142` (old curator) in a diff, it's a regression.
2. **`tweaks.set(...)` instead of `setTweak(...)`.** `useTweaks` returns an array tuple, not an object. Use destructuring.
3. **Style object name collisions.** Each Babel script gets its own scope, but `const styles = { ... }` at the top level of multiple files breaks. Use unique names like `formStyles`, `salesStyles`. Inline styles are fine for one-offs.
4. **Re-mounting screens cause animation loops.** If you add a parent state setter that fires on every render, the screen-anim will reset constantly. We removed the entry animation entirely for this reason. Don't add it back without verifying parent stability.
5. **Cache busting.** `styles.css?v=N` — bump N when you change styles, or your iframe will serve stale CSS during dev. The standalone bundle inlines everything so this only matters during dev.
6. **`scrollIntoView` is banned.** It can break the host webview. Use direct scroll math.
7. **Adding an entry animation that uses `opacity: 0` start without `animation-fill-mode: both`** means screens render permanently invisible if React remounts. Don't.

---

## 11 · Rebuilding the standalone bundle

After your changes are stable:

```
1. Open RoleMaster Prototype.html — confirm clean console.
2. Use the host's "Save as standalone HTML" flow (or super_inline_html tool):
     input:  RoleMaster Prototype.html
     output: RoleMaster Prototype (standalone).html
3. Open the standalone file directly (not via dev server) and confirm it boots.
```

Don't hand-edit the standalone file — it's regenerated.

---

## 12 · Sample data (don't break these IDs)

`data.jsx` exposes:

- `window.SUPPLIER` — the demo company (Vigil Advisory Limited)
- `window.PRODUCTS` — 4 candidate products on S3
- `window.PROD_TMX` — full intake data for S4 (the AML transaction monitor product)
- `window.QUEUE` — 6 submissions on S6 inbox
- `window.WORKBENCH_FIELDS` — field-by-field review state on S7
- `window.ROLEPACKS` — 9 published RolePacks on S10. Only `RP-AML` has full detail; the rest render the truncated view.

Keep the IDs (`RP-AML`, `RP-KYC`, etc.) stable — they're referenced from the App router (`selectedRolepack` state).

---

## 13 · When you're done

1. All §8 boxes ticked.
2. `gaps.md` exists and lists anything you couldn't fix (with screenshots).
3. Standalone bundle regenerated and verified.
4. Console is clean across all 11 screens, both languages, all density/roundness combos.
5. Add a `CHANGELOG.md` entry summarizing what tightened.

Then hand back. The user will spot-check on a real device and give next steps.

---

*Last updated: handoff from Claude (design) to Claude Code (engineering). Ask questions early, ship tight.*
