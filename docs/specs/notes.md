# RoleMaster Engineering Spec — Cross-cutting notes & ship order

> **Context:** Refer to README for the tier files. This document covers what to build first and the cross-cutting rules every ticket must respect.

---

# Suggested ship order

```
Week 1: T1.1 → T1.2 → T1.3 → T1.4 → T1.5
        (workbench becomes real; biggest user-visible improvement)

Week 2: T2.3 → T2.1 → T2.2 → T2.4 → T2.5
        (real PPT/PDF generation; sales catalog actually useful)

Week 3: T3.1 → T3.2 → T3.3 → T3.4
        (multi-product support; can onboard Vigil)

Week 4: T4.1 → T4.2 → T4.3 → T4.5 → T4.6
        (polish; remove legacy code)

Week 5: T5.8 → T5.5 → T5.1 → T5.2 → T5.3
        (hardening; collaboration; observability)

As-needed: T5.4, T5.6, T5.7, T4.4
```

T5.8 (cost price guard) is the only one I'd consider promoting earlier — it's defensive but cheap to ship and prevents a costly bug.

---

# General notes for Claude Code

1. **Never break the supplier-facing language rule.** No "RolePack," "能力/知识/接口," "Curator," "Catalog," "Sales model," "Self-serve/Sales-assist" anywhere in supplier UI. The `i18n.js` keys are scoped — `supplier.*` keys must use only customer-friendly language.

2. **Bilingual is non-negotiable.** Every new string in either language is a bug if its counterpart doesn't exist.

3. **Always sanitize cost price.** Per T5.8.

4. **Preserve existing patterns.** The `_helpers.js`, `_middleware.js`, audit log, JWT auth, R2 upload conventions all work. Don't introduce parallel patterns.

5. **Test against both real Claude and key-missing fallback.** Every Claude call needs a graceful path when the API key is unset — even if just returning `{ ok: false, reason: 'no_api_key' }`.

6. **No tests required, but every ticket has a `Manual verification` section.** Run them.

7. **When in doubt, refer to:** the project audit (this conversation), the requirements doc (`RoleMaster_Complete_Requirements.md`), the design brief (`RoleMaster_Design_Brief.md`).

---

**End of specification.**
