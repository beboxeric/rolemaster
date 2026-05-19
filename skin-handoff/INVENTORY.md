# Screen inventory — RoleMaster v2

**Legend**
- 🎨 = mostly inline `style={{}}` (most v2 screens)
- 🏷️ = uses className for layout (older screens, easier to restyle via CSS)

## Public

| File | URL | Layout | Notes |
|---|---|---|---|
| `screens/landing.jsx` | `/` | 🏷️ | landing page; selects platform |
| `screens/portal-login.jsx` | `/supplier`, `/curator`, `/sales` (logged out) | 🏷️ | per-platform login card on `.hero-bg` background |

## Supplier flow

| File | URL | Layout | Notes |
|---|---|---|---|
| `screens-v2/register.jsx` | `/supplier/register` | 🎨 + `.hero-bg` | email + password form card |
| `screens-v2/company-setup.jsx` | `/supplier/company-setup` | 🎨 | one-time company info form (run once after register) |
| `screens/supplier-home.jsx` | `/supplier` | 🎨 + `.hero-bg` | **two-pane dashboard** — sticky company info card on left, products list on right |
| `screens-v2/onboard.jsx` | `/supplier/onboard` and `/supplier/onboard/:id` | 🎨 | new product entry: name + description + materials drop-zone + file rows |
| `screens-v2/capabilities.jsx` | `/supplier/intake/:id/capabilities` | 🎨 | AI-extracted capability cards w/ editable name + desc + Add/Re-analyze buttons; loading state shows `KnowledgeCards` carousel |
| `screens-v2/roles.jsx` | `/supplier/intake/:id/roles` | 🎨 | role cards using `HierarchicalPicker` for industry/dept/size + capability chip toggles + × delete role |
| `screens-v2/role-details.jsx` | `/supplier/intake/:id/role/:rpId/details` | 🎨 | **complex** — top tab strip across all roles, multi-section form on left, side `Copilot` panel on right with proactive intro chips and chat bubbles. API doc upload list with editable display name. |
| `screens-v2/service-pricing.jsx` | `/supplier/intake/:id/service-pricing` | 🎨 | shared service+pricing form: 3 multi-select pickers (demo / delivery / language), region picker w/ search + custom |
| `screens-v2/review.jsx` | `/supplier/intake/:id/review` | 🎨 | read-only summary of every role + service+pricing, with Edit links jumping back |
| `screens-v2/done.jsx` | `/supplier/intake/:id/done` | 🎨 | per-rolepack status cards (`审阅中` / `已发布`) with View links |

## Curator

| File | URL | Layout | Notes |
|---|---|---|---|
| `screens-v2/curator-inbox.jsx` | `/curator` | 🎨 | tabs (Pending / Published / All) + product card list |
| `screens-v2/curator-review.jsx` | `/curator/intake/:id` | 🎨 | **complex** — left sidebar with role list + "Publish all" button; main pane shows generated content (one-liner card, FAQ list, pitch outline, discovery questions) |

## Sales

| File | URL | Layout | Notes |
|---|---|---|---|
| `screens-v2/sales-library.jsx` | `/sales` (library), `/sales/rolepack/:id` (detail) | 🎨 | searchable library list + per-rolepack detail with sections |

## Shared components

| File | Used in | Notes |
|---|---|---|
| `screens-v2/HierarchicalPicker.jsx` | roles, service-pricing | multi-select dropdown w/ main → sub categories, search, custom-add |
| `screens-v2/KnowledgeCards.jsx` | capabilities, roles, done | AI-loading carousel: rotating cards while extract/match runs (~30-60s) |
| `screens-v2/StatusBanner.jsx` | capabilities, roles, role-details | "Under review" / "Published" banner shown on locked screens |

## Chrome (header / stepper)

| File | Notes |
|---|---|
| `chrome.jsx` | `AppHeader` (supplier), `CuratorHeader`, `PlatformHeader`, `NotificationBell`, `ProcessStepper`, `getPlatformSteps`. Already class-based — easy to restyle via CSS. Currently has frosted glass + gradient hairline. |

## Edge cases worth seeing

- **Long product names** (>40 chars Chinese, or English no-spaces) — onboard.jsx, supplier-home.jsx
- **Many capabilities** (10+ chips on a role card) — roles.jsx
- **Empty states** — supplier-home with no products, curator-inbox with no submissions, capabilities while loading
- **Locked / read-only states** — visit any supplier intake screen for a `submitted` product (use `vigil@demo` to see this)
- **Loading carousels** — visit `/supplier/intake/:id/capabilities` on a fresh upload; you'll see the `KnowledgeCards` rotate
- **Copilot proactive intro** — open `/supplier/intake/:id/role/:rpId/details` on a freshly-prefilled role; the Copilot side panel opens with an "I noticed N empty fields" intro + clickable gap chips
- **Tab strip overflow** — when a product has 5+ roles, the role tab strip scrolls horizontally
- **Mobile width (~375px)** — current site is desktop-first; quick wins available

## What's most worth your attention

These are the screens with the strongest visual presence and most opportunity:

1. **`screens-v2/role-details.jsx`** — the form-with-side-panel layout. The Copilot bubble styling, the section cards, the tab strip, the field highlights, the auto-scroll-on-fill animation. This is where users spend the most time.
2. **`screens/supplier-home.jsx`** — the dashboard split layout. First thing returning suppliers see.
3. **`screens-v2/capabilities.jsx` + `roles.jsx`** — the AI loading state + the result-confirmation cards. Great moments for personality.
4. **`screens-v2/curator-review.jsx`** — the sidebar + main-pane review pattern. Shows what curators see daily.
5. **`screens-v2/sales-library.jsx`** — the catalog browse + rolepack detail. Sales users will live in here.
