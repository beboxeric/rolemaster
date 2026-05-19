# Briefing — RoleMaster v2 skin retheme (round 2)

> Round 1 didn't work. The CSS you produced was excellent for primitives
> (header, buttons, inputs, badges, gradients) but **most of the actual
> pages of this app use inline `style={{}}` props in JSX, not className.**
> So your beautiful card / shell / hero styles had no DOM to attach to.
>
> This package contains **every screen of the live app**. Please redesign
> at the screen level — not just the primitives.

## Live site

https://rolemaster.pages.dev — currently shows the round-1 retheme half-applied (header, buttons, body bg are themed; card-heavy screens still look v0). Demo accounts (password = `demo`):

- supplier — self-register, or `vigil@demo`
- curator — `grace@rolemaster.io`
- sales — `sales@rolemaster.io`

## Critical constraint — inline styles

Most card/layout/spacing decisions in v2 screens are written as `style={{...}}` in the JSX. This was done for speed. To really retheme this app, you have **two options** (you pick per-screen):

**Option A — Replace inline styles with className.** Add class names to the JSX, write CSS for those classes in `styles.css`. Cleaner long-term but requires touching JSX.

**Option B — Edit the inline styles directly.** Open the `.jsx` file, change the `style={{}}` blocks to whatever you want. Faster, but ties styling to component code.

Use whichever is appropriate per situation. For repeated patterns (cards, panels, chips, tab strips), favor option A. For one-offs (a specific hero), option B is fine.

You can hand back any combination of:
- A modified `styles.css`
- Modified individual `.jsx` files (any of the screens — feel free)
- A new `*.css` file we should import (we'll wire it up)
- A list of new utility classes we should add to `App.jsx`'s body modifier system

We'll merge whatever you produce.

## What's in this package

```
skin-handoff/
├── briefing.md                              ← you're here
├── INVENTORY.md                             ← every screen + its layout style
├── source/
│   ├── styles.css                           ← current global stylesheet
│   ├── tweaks.jsx                           ← in-app live tweak panel (gear icon)
│   ├── chrome.jsx                           ← header, stepper, notifications
│   ├── App.jsx                              ← routing + tweak/CSS-var wiring
│   ├── index.html                           ← Google Fonts link
│   ├── screens/
│   │   ├── landing.jsx                      ← / homepage
│   │   ├── portal-login.jsx                 ← supplier/curator/sales login
│   │   └── supplier-home.jsx                ← supplier dashboard (split layout)
│   └── screens-v2/                          ← 15 supplier flow + curator + sales screens
│       ├── register.jsx                     ← supplier signup
│       ├── company-setup.jsx                ← one-time company info
│       ├── onboard.jsx                      ← per-product entry (name + materials)
│       ├── capabilities.jsx                 ← AI-extracted capability cards
│       ├── roles.jsx                        ← role match cards w/ pickers
│       ├── role-details.jsx                 ← multi-section form + Copilot panel
│       ├── service-pricing.jsx              ← shared service+pricing form
│       ├── review.jsx                       ← read-only summary before submit
│       ├── done.jsx                         ← submitted view
│       ├── HierarchicalPicker.jsx           ← reusable multi-select picker
│       ├── KnowledgeCards.jsx               ← AI-loading carousel
│       ├── StatusBanner.jsx                 ← under-review / published banners
│       ├── curator-inbox.jsx                ← curator queue
│       ├── curator-review.jsx               ← per-intake review (sidebar + main)
│       └── sales-library.jsx                ← published rolepack browser + detail
```

## How to walk the app

Open https://rolemaster.pages.dev and visit each URL in `INVENTORY.md`.
Capture screenshots for the spots that bother you visually, sketch a target,
edit the matching `.jsx` (or write CSS).

## Constraints that haven't changed

1. **Bilingual** — every screen renders zh-CN and en. Don't pick fonts
   that drop Chinese glyphs. Current chain: Inter Tight (display) →
   Inter (body) → Noto Sans SC. Keep an SC fallback in any new chain.
2. **Three platforms must be visually distinct** — supplier/curator/sales.
   Color is the primary cue.
3. **Readability** — text on backgrounds (especially gradient hero pages)
   must hit WCAG AA at 14px body / 12px label.
4. **Don't rename** existing class names, CSS variable names, or body
   modifier classes. Add new ones; don't break old ones.
5. **No CSS framework imports.** Plain CSS only. Vite handles the build.
6. **Hero backgrounds are opt-in** — `.hero-bg` triggers a 60s gradient
   drift. Already added to: register, supplier-home, portal-login.
   Dense form / table screens should NOT have it.

## Hand-back format

Drop a zip on the user's Desktop (or pasted into chat) containing only the
files you modified. We'll diff against the originals here and merge.

Don't worry about screenshots — Claude Code will deploy and the user will
verify visually.

## Where to start

1. Read `INVENTORY.md` first — it lists every screen with one sentence
   about its layout pattern, plus which uses inline styles vs class names.
2. Open the live site, walk supplier flow end-to-end (register → company
   setup → dashboard → add product → capabilities → roles → details →
   pricing → review → done). That's the longest journey.
3. Identify 5-8 visual themes (e.g. "card style for the v2 panels",
   "tab strip pattern", "split-pane shell", "loading state", "review
   summary section", "copilot bubble + intro chips") and design those.
4. Return the modified files.
