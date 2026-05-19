# RoleMaster — Engineering Specification (Tickets)

**Document purpose:** Specification for implementing the remaining features of the RoleMaster platform. Written for Claude Code, based on the project state audit dated late April 2026.

**How to use this:** Each ticket below is self-contained. Pick one ticket, read it fully, implement it, ship. Don't try to read all tickets and synthesize — they reference each other only through the **Dependencies** field.

**Repository conventions** (apply to every ticket):

- Stack: React 18 + Vite SPA on Cloudflare Pages with Pages Functions; D1 (SQLite) for data; R2 for files; Qwen (DashScope OpenAI-compatible endpoint) for AI calls — call sites use `callClaude(env, opts)` from `functions/api/_lib/ai/client.js` (the name is legacy; the implementation calls Qwen)
- Frontend: `app/src/`, plain React with hooks, no state library beyond context
- Backend: `functions/api/`, Pages Functions following the existing `_helpers.js` patterns
- DB schema lives in `schema.sql`; migrations are applied by editing the schema and running `wrangler d1 execute rolemaster-db --file=schema.sql --remote` (production) or `--local` (dev)
- All currency in HKD unless specified; all dates ISO-8601 in DB, locale-formatted in UI
- Bilingual everywhere — every new UI string must have a `zh` and `en` entry in `app/src/i18n.js`
- Field values that come from AI generation are stored as `{ value_zh, value_en }` pairs (existing convention from `submission_fields`)
- Auth: every new API route under `/api/` is protected by `_middleware.js` by default; add to public allowlist only with strong reason
- No new dependencies without justification in the ticket
- No tests in this codebase yet (per audit) — don't add a test framework; instead, every ticket has a **Manual verification** section that lists steps to confirm it works

---



## Tier files

- [Tier 1](./tier_1.md) — Close the curator workbench gap
- [Tier 2](./tier_2.md) — Real AI asset generation
- [Tier 3](./tier_3.md) — Multi-product per supplier
- [Tier 4](./tier_4.md) — Confirm screen, polish, dead code
- [Tier 5](./tier_5.md) — Hardening
- [Cross-cutting notes & ship order](./notes.md)
