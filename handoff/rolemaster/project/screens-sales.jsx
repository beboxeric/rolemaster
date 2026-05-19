// Sales flow: Screen 9 (login), 10 (catalog), 11 (RolePack detail).
// Plus AssetGenerationOverlay for screen 8.5 transitional state.

const { useState: uSS, useEffect: uES, useMemo: uMS, useRef: uRS } = React;

// ───────── Toast helper ─────────
function useToast() {
  const [msg, setMsg] = uSS(null);
  uES(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 1800);
      return () => clearTimeout(t);
    }
  }, [msg]);
  return [msg, setMsg];
}

// ───────── Asset generation overlay (Screen 8.5) ─────────
function AssetGenerationOverlay({ lang, onDone, rolepackName }) {
  const [step, setStep] = uSS(0);
  uES(() => {
    if (step >= 4) {
      const t = setTimeout(() => onDone(), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep(s => s + 1), 750);
    return () => clearTimeout(t);
  }, [step]);

  const tags = lang === "zh" ? "银行 / SVF / 证券" : "Banking / SVF / Securities";
  const steps = [
    window.t("gen_step1", lang),
    window.t("gen_step2", lang),
    window.t("gen_step3", lang, { tags }),
    window.t("gen_step4", lang),
  ];

  return (
    <div className="gen-overlay">
      <div className="gen-card">
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 8
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: 8,
            background: "var(--cop-bg)", color: "var(--cop-border)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700
          }}>✦</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              {window.t("gen_title", lang)}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
              {window.t("gen_for", lang, { name: rolepackName })}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          {steps.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <div key={i} className={"gen-step " + state}>
                <span className="check">
                  {state === "done" ? "✓" : state === "active" ? "◐" : ""}
                </span>
                <span style={{ flex: 1 }}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────── Screen 9 — Sales login ─────────
function ScreenSalesLogin({ lang, setLang, goNext }) {
  const [email, setEmail] = uSS("");
  const [password, setPassword] = uSS("");
  const [err, setErr] = uSS("");

  const submit = (e) => {
    e.preventDefault();
    if (!email.includes("@")) { setErr(lang === "zh" ? "请输入有效邮箱" : "Enter a valid email"); return; }
    if (password !== "demo") { setErr(lang === "zh" ? "演示密码:demo" : "Demo password is: demo"); return; }
    goNext();
  };

  return (
    <div className="sales-login platform-sales">
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--plat-sales)" }} />
      <div className="sales-login-card">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--plat-sales)", color: "white",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 22, marginBottom: 14,
            boxShadow: "0 4px 14px rgba(0,0,0,0.08)"
          }}>R</div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
            RoleMaster
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "6px 0 6px", letterSpacing: "-0.01em" }}>
            {window.t("s9_title", lang)}
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
            {window.t("s9_sub", lang)}
          </p>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="field-label">{window.t("s9_email", lang)}</label>
            <input className="text-input" type="email" value={email}
              onChange={e => { setEmail(e.target.value); setErr(""); }}
              placeholder="sales@yourcompany.com" autoFocus />
          </div>
          <div>
            <label className="field-label">{window.t("s9_password", lang)}</label>
            <input className="text-input" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setErr(""); }}
              placeholder="••••" />
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
              {window.t("s9_demo_hint", lang)}
            </div>
          </div>
          {err && <div style={{ fontSize: 12, color: "var(--st-empty-ink)" }}>{err}</div>}
          <button type="submit" className="btn btn-primary" style={{ marginTop: 4, padding: "12px 18px" }}>
            {window.t("s9_signin", lang)} →
          </button>
        </form>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "center" }}>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>
      </div>
    </div>
  );
}

// ───────── Sales header (uses unified PlatformHeader) ─────────
function SalesHeader({ lang, setLang, onSignOut, showBack, onBack }) {
  const right = (
    <>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
        {lang === "zh" ? "销售网络" : "Sales network"}
      </span>
      <button className="btn-ghost" onClick={onSignOut} style={{ padding: "5px 10px", fontSize: 12, color: "var(--ink-2)" }}>
        {window.t("s10_signout", lang)}
      </button>
    </>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <window.PlatformHeader platform="sales" lang={lang} setLang={setLang} right={right}
        contextLabel={showBack ? null : window.t("s10_title", lang)} />
      {showBack && (
        <div style={{ padding: "8px 24px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "4px 8px", fontSize: 13, color: "var(--ink-2)" }}>
            ← {window.t("s11_back", lang)}
          </button>
        </div>
      )}
    </div>
  );
}

// ───────── Multi-select filter chip ─────────
function FilterChip({ label, options, selected, setSelected }) {
  const [open, setOpen] = uSS(false);
  const ref = uRS(null);
  uES(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const toggle = (id) => {
    setSelected(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };
  const count = selected.length;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={"filter-chip " + (count ? "active " : "") + (open ? "open" : "")} onClick={() => setOpen(!open)}>
        {label}
        {count > 0 && <span className="count">{count}</span>}
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="filter-popover">
          {options.map(o => (
            <label key={o.id}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              <span>{o.label}</span>
              <span className="opt-count">{o.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────── Screen 10 — Sales catalog ─────────
function ScreenCatalog({ lang, setLang, goNext, goBack, openRolepack }) {
  const [search, setSearch] = uSS("");
  const [industries, setIndustries] = uSS([]);
  const [personas, setPersonas] = uSS([]);
  const [regions, setRegions] = uSS([]);
  const [orgSizes, setOrgSizes] = uSS([]);
  const [sort, setSort] = uSS("relevant");

  const all = window.ROLEPACKS;

  // Build option counts from data
  const indOpts = uMS(() => {
    const map = {};
    all.forEach(r => r.industries.forEach(i => map[i] = (map[i] || 0) + 1));
    const labelMap = {
      banking: { zh: "银行", en: "Banking" },
      svf: { zh: "SVF", en: "SVF" },
      securities: { zh: "证券", en: "Securities" },
      insurance: { zh: "保险", en: "Insurance" },
      retail: { zh: "零售", en: "Retail" },
      sme: { zh: "中小企业", en: "SME" },
      brand: { zh: "品牌", en: "Brand" },
      legal: { zh: "法务", en: "Legal" },
    };
    return Object.keys(map).map(k => ({ id: k, label: labelMap[k]?.[lang] || k, count: map[k] }));
  }, [lang]);

  const personaOpts = uMS(() => {
    const m = {};
    all.forEach(r => { const p = r.persona[lang]; m[p] = (m[p] || 0) + 1; });
    return Object.keys(m).map(p => ({ id: p, label: p, count: m[p] }));
  }, [lang]);

  const regionOpts = uMS(() => {
    const fixed = lang === "zh"
      ? [{ id: "HK", label: "香港" }, { id: "SG", label: "新加坡" }, { id: "APAC", label: "亚太" }, { id: "Global", label: "全球" }]
      : [{ id: "HK", label: "Hong Kong" }, { id: "SG", label: "Singapore" }, { id: "APAC", label: "APAC" }, { id: "Global", label: "Global" }];
    return fixed.map(r => ({ ...r, count: all.filter(x => (x.region[lang] || "").toLowerCase().includes(r.id.toLowerCase()) || (r.id === "HK" && (x.region[lang] || "").includes("香港")) || (r.id === "SG" && (x.region[lang] || "").includes("新加坡"))).length }));
  }, [lang]);

  const orgOpts = uMS(() => {
    const labels = lang === "zh"
      ? [{ id: "smb", label: "中小企业 (SMB)" }, { id: "mid", label: "中型 (51-500)" }, { id: "ent", label: "大型 (500+)" }]
      : [{ id: "smb", label: "SMB (1-50)" }, { id: "mid", label: "Mid-market (51-500)" }, { id: "ent", label: "Enterprise (500+)" }];
    return labels.map(o => ({ ...o, count: 2 }));
  }, [lang]);

  const filtered = uMS(() => {
    let list = all.filter(r => {
      if (search) {
        const hay = (r.name[lang] + " " + r.pitch[lang] + " " + r.persona[lang]).toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      if (industries.length && !r.industries.some(i => industries.includes(i))) return false;
      if (personas.length && !personas.includes(r.persona[lang])) return false;
      return true;
    });
    if (sort === "industry") list = [...list].sort((a, b) => a.industryLabels[lang][0].localeCompare(b.industryLabels[lang][0]));
    else if (sort === "price") list = [...list].sort((a, b) => parseInt(String(a.fromPrice).replace(/\D/g, "")) - parseInt(String(b.fromPrice).replace(/\D/g, "")));
    return list;
  }, [search, industries, personas, regions, orgSizes, sort, lang]);

  const resetAll = () => { setIndustries([]); setPersonas([]); setRegions([]); setOrgSizes([]); setSearch(""); };

  return (
    <div className="platform-sales" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SalesHeader lang={lang} setLang={setLang} onSignOut={goBack} />

      <div style={{ padding: "24px 32px 80px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Title */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
            {window.t("s10_title", lang)}
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "4px 0 0" }}>
            {lang === "zh"
              ? "为客户挑选合适的 AI RolePack — 用搜索或筛选缩小范围,点击卡片查看详情。"
              : "Find the right AI RolePack for your customer — search or filter to narrow down, click into any card for materials."}
          </p>
        </div>

        {/* Search bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--ink-3)", fontSize: 14
            }}>🔍</span>
            <input
              className="text-input"
              placeholder={window.t("s10_search_ph", lang)}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 38, height: 42, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <FilterChip label={window.t("s10_filter_industry", lang)} options={indOpts} selected={industries} setSelected={setIndustries} />
          <FilterChip label={window.t("s10_filter_persona", lang)} options={personaOpts} selected={personas} setSelected={setPersonas} />
          <FilterChip label={window.t("s10_filter_region", lang)} options={regionOpts} selected={regions} setSelected={setRegions} />
          <FilterChip label={window.t("s10_filter_orgsize", lang)} options={orgOpts} selected={orgSizes} setSelected={setOrgSizes} />
          {(industries.length || personas.length || regions.length || orgSizes.length || search) ? (
            <button className="btn-ghost" onClick={resetAll} style={{ padding: "6px 10px", fontSize: 12, color: "var(--primary-deep)", fontWeight: 500 }}>
              {window.t("s10_reset", lang)}
            </button>
          ) : null}
        </div>

        {/* Result meta */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0 14px", borderBottom: "1px solid var(--line)", marginBottom: 18,
          fontSize: 13, color: "var(--ink-2)"
        }}>
          <span>{window.t("s10_showing", lang, { n: filtered.length })}</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-input" style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
            <option value="relevant">{window.t("s10_sort_relevant", lang)}</option>
            <option value="recent">{window.t("s10_sort_recent", lang)}</option>
            <option value="industry">{window.t("s10_sort_industry", lang)}</option>
            <option value="price">{window.t("s10_sort_price", lang)}</option>
          </select>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
            {window.t("s10_empty", lang)}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={resetAll}>{window.t("s10_reset", lang)}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
            {filtered.map(r => (
              <button key={r.id} className="rp-card" onClick={() => openRolepack(r.id)}>
                <div className="rp-id-line">
                  <span>{r.id}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                  {r.name[lang]}
                </h3>
                <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0, lineHeight: 1.5,
                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"
                }}>
                  {r.pitch[lang]}
                </p>
                <div className="tag-row">
                  {r.industries.map((i, idx) => (
                    <span key={i} className={"rp-tag ind-" + i}>{r.industryLabels[lang][idx]}</span>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>
                  <div>
                    <div style={{ color: "var(--ink-3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>{window.t("s10_persona_label", lang)}</div>
                    <div style={{ fontWeight: 500 }}>{r.persona[lang]}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--ink-3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>{window.t("s10_region_label", lang)}</div>
                    <div style={{ fontWeight: 500 }}>{r.region[lang]}</div>
                  </div>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--line-2)"
                }}>
                  <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginRight: 4 }}>
                      {window.t("s10_from", lang)}
                    </span>
                    {r.fromPrice}
                  </div>
                  <span style={{ color: "var(--primary-deep)", fontSize: 13, fontWeight: 600 }}>
                    {window.t("s10_view", lang)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── Screen 11 — RolePack detail ─────────
function ScreenRolepackDetail({ lang, setLang, rolepackId, goBack }) {
  const r = window.ROLEPACKS.find(x => x.id === rolepackId) || window.ROLEPACKS[0];
  const [toast, setToast] = useToast();

  const download = (kind) => {
    setToast(`${window.t("s11_downloading", lang)} ${kind === "deck" ? window.t("s11_pitch_deck", lang) : window.t("s11_manual", lang)}`);
  };

  const share = () => setToast(window.t("s11_link_copied", lang));

  const hasFullData = !!r.pain;

  return (
    <div className="platform-sales" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SalesHeader lang={lang} setLang={setLang} onSignOut={goBack} showBack onBack={goBack} />

      <div style={{ padding: "32px 32px 24px", maxWidth: 1080, margin: "0 auto", width: "100%", flex: 1 }}>
        {/* Hero */}
        <div className="rp-id-line" style={{ marginBottom: 8 }}>
          <span>{r.id}</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {r.name[lang]}
        </h1>
        <blockquote style={{
          fontSize: 17, color: "var(--ink)", lineHeight: 1.5, margin: "16px 0 18px",
          padding: "10px 0 10px 16px",
          borderLeft: "3px solid var(--accent)",
          fontStyle: "italic", fontWeight: 400
        }}>
          "{r.pitch[lang]}"
        </blockquote>
        <div className="tag-row" style={{ marginBottom: 28 }}>
          {r.industries.map((i, idx) => (
            <span key={i} className={"rp-tag ind-" + i}>{r.industryLabels[lang][idx]}</span>
          ))}
        </div>

        {/* Materials + Quick Facts */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18, marginBottom: 32 }}>
          {/* Sales Materials */}
          <div style={{ background: "white", border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "var(--accent)" }}>📥</span>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {window.t("s11_materials", lang)}
              </h3>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <button className="asset-card" onClick={() => download("deck")}>
                <div className="asset-icon ppt">PPT</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{window.t("s11_pitch_deck", lang)}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {window.t("s11_slides", lang, { n: r.deck?.slides ?? 7 })} · {(r.deck?.sizeMB ?? 2.4)} MB
                  </div>
                </div>
                <span style={{ color: "var(--primary-deep)", fontSize: 18 }}>↓</span>
              </button>
              <button className="asset-card" onClick={() => download("manual")}>
                <div className="asset-icon pdf">PDF</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{window.t("s11_manual", lang)}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {window.t("s11_pages", lang, { n: r.manual?.pages ?? 4 })} · {(r.manual?.sizeMB ?? 1.1)} MB
                  </div>
                </div>
                <span style={{ color: "var(--primary-deep)", fontSize: 18 }}>↓</span>
              </button>
            </div>
          </div>

          {/* Quick facts */}
          <div style={{ background: "var(--primary-tint)", border: "1px solid var(--primary-line)", borderRadius: 14, padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--primary-deep)", margin: "0 0 12px",
              textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {window.t("s11_quick_facts", lang)}
            </h3>
            <div style={{ display: "grid", gap: 9, fontSize: 13 }}>
              <Fact label={window.t("s11_persona", lang)} value={r.persona[lang]} />
              <Fact label={window.t("s11_decision", lang)} value={r.decisionMaker[lang]} />
              <Fact label={window.t("s11_orgsize", lang)} value={r.orgSize[lang]} />
              <Fact label={window.t("s11_region", lang)} value={r.region[lang]} />
              <Fact label={window.t("s11_languages", lang)} value={r.languages[lang]} />
              <Fact label={window.t("s11_compliance", lang)} value={r.compliance} />
            </div>
          </div>
        </div>

        {hasFullData ? (
          <>
            {/* Overview */}
            {r.overview && (
              <Section title={window.t("s11_overview", lang)}>
                <div style={{
                  fontSize: 15, color: "var(--ink)", lineHeight: 1.7,
                  padding: "16px 20px", background: "white",
                  border: "1px solid var(--line)", borderRadius: 12,
                }}>
                  {r.overview[lang]}
                </div>
              </Section>
            )}

            {/* Pain & Outcome */}
            <Section title={window.t("s11_pain", lang)}>
              <blockquote style={{
                fontSize: 15, color: "var(--ink)", lineHeight: 1.7, margin: 0,
                padding: "16px 22px", background: "white", border: "1px solid var(--line)",
                borderRadius: 12, fontStyle: "italic"
              }}>
                {r.pain[lang]}
              </blockquote>
            </Section>

            <Section title={window.t("s11_outcome", lang)}>
              <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 14, color: "var(--ink)", lineHeight: 1.8 }}>
                {r.outcomes[lang].map((o, i) => <li key={i}>{o}</li>)}
              </ul>
              <div style={{
                marginTop: 12, padding: "10px 14px",
                background: "var(--st-fill-bg)", color: "var(--st-fill-ink)",
                border: "1px solid var(--st-fill-border)",
                borderRadius: 8, fontSize: 13, fontWeight: 500
              }}>
                <span style={{ opacity: 0.7, marginRight: 6 }}>{window.t("s11_proof", lang)}:</span>
                {r.proof[lang]}
              </div>
            </Section>

            {/* What it does + prereqs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 28 }}>
              <Section title={window.t("s11_what", lang)} compact>
                <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 14, color: "var(--ink)", lineHeight: 1.7 }}>
                  {r.capabilities[lang].map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Section>
              <Section title={window.t("s11_prereqs", lang)} compact>
                <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 14, color: "var(--ink)", lineHeight: 1.7 }}>
                  {r.prereqs[lang].map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </Section>
            </div>

            <Section title={window.t("s11_deployment", lang)}>
              <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6, margin: 0 }}>{r.deployment[lang]}</p>
            </Section>

            <Section title={window.t("s11_pricing", lang)}>
              <div style={{ background: "white", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 4 }}>{r.pricing[lang].model}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                  {r.pricing[lang].from}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>{r.pricing[lang].custom}</div>
              </div>
            </Section>

            <Section title={window.t("s11_pitch", lang)}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  {window.t("s11_30s", lang)}
                </div>
                <div style={{
                  background: "var(--cop-bg)",
                  border: "1px solid #DECDF0",
                  borderRadius: 12,
                  padding: "16px 20px",
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: "var(--ink)",
                  fontStyle: "italic"
                }}>
                  "{r.pitchScript[lang]}"
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  {window.t("s11_discovery_q", lang)}
                </div>
                <ol style={{ margin: 0, padding: "0 0 0 22px", display: "grid", gap: 8, fontSize: 14, color: "var(--ink)", lineHeight: 1.55 }}>
                  {r.discovery[lang].map((q, i) => <li key={i}>{q}</li>)}
                </ol>
              </div>
            </Section>
          </>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", background: "white", borderRadius: 12, border: "1px solid var(--line)" }}>
            {lang === "zh" ? "更多详情即将上线 — 请下载销售素材了解完整内容。" : "More detail coming soon — please download the sales materials for the full content."}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky-footer">
        <button className="btn btn-ghost" onClick={goBack}>{window.t("s11_back", lang)}</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={share}>↗ {window.t("s11_share", lang)}</button>
          <button className="btn btn-secondary" onClick={() => download("manual")}>📋 {window.t("s11_manual", lang)}</button>
          <button className="btn btn-primary" onClick={() => download("deck")}>📊 {window.t("s11_pitch_deck", lang)}</button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ minWidth: 86, fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ flex: 1, color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Section({ title, children, compact }) {
  return (
    <div style={{ marginBottom: compact ? 0 : 28 }}>
      <h2 style={{
        fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em",
        margin: "0 0 10px", paddingBottom: 8, borderBottom: "1px solid var(--line)"
      }}>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

Object.assign(window, {
  AssetGenerationOverlay, ScreenSalesLogin, ScreenCatalog, ScreenRolepackDetail, SalesHeader
});
