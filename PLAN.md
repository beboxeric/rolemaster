# RoleMaster fix plan — RESOLVED

> ## ⛔️ DEPLOY RULE — DO NOT FORGET
> **Vite outputs to `dist/` at the project root, NOT `app/dist/`.**
> The correct deploy command is:
> ```bash
> cd C:/AI/RoleMaster && npx wrangler pages deploy dist --project-name=rolemaster --branch=main --commit-dirty=true
> ```
> If wrangler says `Uploaded 0 files (3 already uploaded)` after a build that produced new files, **you are deploying the wrong directory.** Verify the dist files match the build output:
> ```bash
> ls -la C:/AI/RoleMaster/dist/assets/    # must match the JS chunk hash from `npm run build`
> ```
> Never deploy from `app/dist/` — that path contains a stale May-1 build.


## Root cause of the "everything broke" + canonical-stuck issue

**I was deploying the wrong directory all along.** Vite's `vite.config.js` outputs the build to `dist/` at the project root (`C:/AI/RoleMaster/dist/`), but I kept running `npx wrangler pages deploy app/dist ...` which uploaded a STALE 3-day-old build sitting in `app/dist/`.

Symptoms:
- Every deploy showed `Uploaded 0 files (3 already uploaded)` — wrangler saw bytecode-identical files (the same stale ones from May 1) every time
- Production canonical `rolemaster.pages.dev` was serving `index-C1iXdUcx.js` (the May 1 stale chunk) — that's why it showed totally different copy than 7ca5907b
- 7ca5907b worked because someone (a previous session) deployed correctly from `dist/` at some point
- New "broken" deploys never actually replaced anything in CDN — that explains why the user saw old content despite my many "deploys"

The user's bug reports (UI broken, gradient gone, JSON parse error, contact fields missing) were all from a stale build. None of my changes were actually live during this entire conversation until I corrected the deploy path.

**Fix:** `cd C:/AI/RoleMaster && npx wrangler pages deploy dist --project-name=rolemaster --branch=main --commit-dirty=true` — deploys from the project root `dist/`, not `app/dist/`.

## What is now live (canonical https://rolemaster.pages.dev — verified in Chrome)

| Screen | Change | Status |
| --- | --- | --- |
| /supplier (dashboard) | "我的产品入驻" + "+ 入驻新产品" + product cards + mesh gradient | ✅ verified |
| /supplier/company-setup | Two cards: 公司 + 联系人(姓名/手机/工作邮箱); contact_email auto-prefills from registered email | ✅ verified |
| /supplier/intake/:id/capabilities | `RC-01 能力 N` header (small font, code first); `+ 添加能力` `↻ AI 重新分析` upper-right; pill `✦ AI 识别到 5 项能力`; lede full width | ✅ verified |
| /supplier/intake/:id/roles | `RP-01 岗位 N` header; `+ 添加岗位` `↻ AI 重新匹配` upper-right; pill `✦ AI 匹配到 2 个岗位`; industry dropdown shows `14/54` count; size shows `2/5` | ✅ verified |
| /supplier/intake/:id/role/:rpId/details | Tab strip sticky `top: 60`; tab labels `RP-01 岗位 N · 名称`; Copilot panel sticky in flex; required fields show red `*` + red border + `⚠` line; API doc upload row with [name input] + [+ Upload] button + checkbox per file | ✅ deployed (need user walk-through to verify) |
| /supplier/intake/:id/service-pricing | Block "next" on missing required fields; banner lists missing fields | ✅ deployed |
| /supplier/intake/:id/review | White v2-input-card per section; capabilities collapsed by default (click ▸ to expand description); roles simplified to `RP-01 岗位 N · 名称` + meta + 主要痛点 + 能力如何嵌入工作流 + 查看完整 → | ✅ verified |

Also live:
- API JSON parse fix in `app/src/api.js` — non-JSON responses now produce clean errors instead of "Unexpected token '<'..."
- Validation styles in `skin-v2.css` — `.text-input.error`, `.field-label.error`, `.field-error`, `.v2-banner-error`, `.v2-h2--sm`, `.v2-section__head--actions`
- Backend `company-info.js` auto-creates `website`, `contact_name`, `contact_phone`, `contact_email` columns via idempotent `ALTER TABLE ... ADD COLUMN` (no manual migration needed)

## Known limitations / next steps the user might want
- Industry chips still show `manufacturing` `healthcare` etc. in zh mode because the taxonomy data has no zh translation for those items. The labelFor logic prefers zh first, but falls back to en when zh is missing. Real fix is data-side — backfill name_zh in the industries taxonomy.
- Service-pricing validation is a banner-only check; per-field red borders aren't applied (would need wrapping every picker — heavier change).
- Tab strip / Copilot stickiness needs in-flow validation by the user (couldn't fully exercise in Chrome MCP without filling materials end-to-end).
