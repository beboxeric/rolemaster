// Screen 7 — Curator workbench. Three-pane layout, dense.

const { useState: uS7, useEffect: uE7 } = React;

function ScreenWorkbench({ lang, setLang, goNext, goBack }) {
  const [tab, setTab] = uS7("decompose"); // decompose | sales
  const [layerTab, setLayerTab] = uS7("capabilities");
  const [recChoice, setRecChoice] = uS7("primary");
  const [decision, setDecision] = uS7("approve");
  const [checks, setChecks] = uS7([true, true, true, true, false, true, false]);
  const [comments, setComments] = uS7("");
  const [expandedFAQ, setExpandedFAQ] = uS7(0);

  // ─── Slice 1 (curator-portal redesign): briefing banner + phase indicator ───
  const [briefingOpen, setBriefingOpen] = uS7(true);   // default expanded on first open
  const [phase, setPhase] = uS7("review");              // review | discussion | finalize
  const [callDate, setCallDate] = uS7("");
  const [showCallModal, setShowCallModal] = uS7(false);
  const [pendingCallDate, setPendingCallDate] = uS7("");
  const [copiedToast, setCopiedToast] = uS7(false);

  const PHASE_ORDER = ["review", "discussion", "finalize"];
  const phaseIdx = PHASE_ORDER.indexOf(phase);

  // Click-to-jump from briefing chips into form-area elements with [data-field-id].
  // Falls back to flashing the chip itself when no anchor exists in this view.
  const jumpToField = (fieldId, fallbackEl) => {
    const target = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (target) {
      // Find the nearest scrollable ancestor (curator-pane is overflow:auto).
      let scroller = target.parentElement;
      while (scroller && scroller !== document.body) {
        const oy = getComputedStyle(scroller).overflowY;
        if (oy === "auto" || oy === "scroll") break;
        scroller = scroller.parentElement;
      }
      if (scroller && scroller !== document.body) {
        const top = target.getBoundingClientRect().top
                  - scroller.getBoundingClientRect().top
                  + scroller.scrollTop - 24;
        scroller.scrollTo({ top, behavior: "smooth" });
      }
      target.classList.remove("briefing-jump-flash");
      void target.offsetWidth;
      target.classList.add("briefing-jump-flash");
      setTimeout(() => target.classList.remove("briefing-jump-flash"), 1700);
    } else if (fallbackEl) {
      fallbackEl.classList.remove("briefing-jump-flash");
      void fallbackEl.offsetWidth;
      fallbackEl.classList.add("briefing-jump-flash");
      setTimeout(() => fallbackEl.classList.remove("briefing-jump-flash"), 1700);
    }
  };

  const advancePhase = () => {
    if (phase === "review") {
      // Prompt for call date before entering Discussion.
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setPendingCallDate(callDate || `${yyyy}-${mm}-${dd}`);
      setShowCallModal(true);
    } else if (phase === "discussion") {
      setPhase("finalize");
    } else if (phase === "finalize") {
      goNext();
    }
  };

  const confirmCallDate = () => {
    setCallDate(pendingCallDate);
    setPhase("discussion");
    setShowCallModal(false);
  };

  const copyAllQuestions = () => {
    const qs = window.BRIEFING.questions.map((q, i) => `${i + 1}. ${q.q[lang]}`).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(qs).then(() => {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 1800);
      });
    } else {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 1800);
    }
  };

  // Keyboard: b toggles briefing, p advances phase. Inert when an input is focused.
  uE7(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "b" || e.key === "B") {
        setBriefingOpen(v => !v);
      } else if (e.key === "p" || e.key === "P") {
        advancePhase();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, callDate]);

  const allChecked = checks.every(Boolean);
  const cards = window.LAYERS[layerTab];

  // Format the saved call date for display in the curator's locale.
  const formatCallDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (lang === "zh") return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="screen-anim platform-curator" style={{ minHeight: "100vh" }}>
      <CuratorHeader lang={lang} setLang={setLang} />

      {/* Sub-header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "10px 24px", background: "white", borderBottom: "1px solid var(--line)",
        fontSize: 13
      }}>
        <button className="btn-ghost" onClick={goBack} style={{ padding: "4px 10px", fontSize: 12, color: "var(--ink-2)" }}>
          {window.t("s7_back", lang)}
        </button>
        <div style={{ height: 16, width: 1, background: "var(--line)" }} />
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>S-2418</span>
          <span style={{ margin: "0 10px", color: "var(--ink-3)" }}>·</span>
          <strong style={{ color: "var(--navy-ink)" }}>Vigil Advisory Limited</strong>
          <span style={{ margin: "0 8px", color: "var(--ink-3)" }}>›</span>
          <span>TMX</span>
          <span style={{ marginLeft: 8, color: "var(--ink-3)", fontSize: 12 }}>
            ({window.PRODUCTS.find(p => p.id === "TMX").subtitle[lang]})
          </span>
        </div>
        <span className="status-badge ai" style={{ marginLeft: "auto" }}>
          {window.t("s6_status_new", lang)}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 12 }}>
          <span><span className="kbd">a</span> {lang === "zh" ? "批准" : "approve"}</span>
          <span><span className="kbd">r</span> {lang === "zh" ? "请求修改" : "request"}</span>
          <span><span className="kbd">b</span> {lang === "zh" ? "简报" : "briefing"}</span>
          <span><span className="kbd">p</span> {lang === "zh" ? "推进" : "phase"}</span>
        </span>
      </div>

      {/* ───────── Phase indicator (Slice 1) ───────── */}
      <div className="phase-indicator">
        <span className="phase-label">{lang === "zh" ? "阶段" : "Phase"}</span>
        {PHASE_ORDER.map((p, i) => {
          const labelKey = p === "review" ? "s7_phase_review"
                         : p === "discussion" ? "s7_phase_discussion"
                         : "s7_phase_finalize";
          const isDone = i < phaseIdx;
          const isCurrent = i === phaseIdx;
          const cls = isDone ? "done" : isCurrent ? "current" : "future";
          const clickable = i <= phaseIdx;
          return (
            <React.Fragment key={p}>
              {i > 0 && <span className={`phase-connector ${i <= phaseIdx ? "filled" : ""}`} />}
              <span
                className={`phase-step ${cls} ${clickable ? "clickable" : ""}`}
                onClick={() => clickable && setPhase(p)}
                title={clickable && !isCurrent ? (lang === "zh" ? "返回此阶段" : "Jump back to this phase") : ""}
              >
                <span className="pdot">{isDone ? "✓" : i + 1}</span>
                <span>{window.t(labelKey, lang)}</span>
                {p === "discussion" && callDate && (
                  <span className="phase-call-chip" style={{ marginLeft: 4 }}>
                    📞 {formatCallDate(callDate)}
                  </span>
                )}
              </span>
            </React.Fragment>
          );
        })}
        <div className="phase-meta">
          <span style={{ fontSize: 11 }}>
            <span className="kbd">p</span> {window.t("s7_phase_kbd", lang)}
          </span>
          <button className="phase-advance-btn" onClick={advancePhase}>
            {phase === "review"     ? window.t("s7_phase_review_done", lang)
           : phase === "discussion" ? window.t("s7_phase_discussion_done", lang)
                                    : window.t("s7_phase_finalize_done", lang)} →
          </button>
        </div>
      </div>

      {/* ───────── AI Briefing banner (Slice 1) ───────── */}
      {!briefingOpen && (
        <div
          className="briefing-banner collapsed-only"
          onClick={() => setBriefingOpen(true)}
          role="button"
          tabIndex={0}
        >
          <span style={{ color: "var(--cop-border)", fontWeight: 700 }}>✦</span>
          <span style={{ flex: 1 }}>
            {lang === "zh"
              ? `简报 · ${window.BRIEFING.what.zh.length} 条要点 · ${window.BRIEFING.questions.length} 个建议提问`
              : `Briefing · ${window.BRIEFING.what.en.length} bullets · ${window.BRIEFING.questions.length} suggested questions`}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
            <span className="kbd">b</span> {window.t("s7_briefing_expand", lang)}
          </span>
        </div>
      )}
      {briefingOpen && (
        <div className="briefing-banner expanded">
          <div className="briefing-banner-head" onClick={() => setBriefingOpen(false)}>
            <span className="chev">▶</span>
            <span>{window.t("s7_briefing_title", lang)}</span>
            <span style={{
              fontSize: 11, fontWeight: 500, color: "var(--ink-3)",
              padding: "2px 8px", borderRadius: 4, background: "var(--bg)"
            }}>
              {window.PRODUCTS.find(p => p.id === "TMX").name} · {window.SUPPLIER.name}
            </span>
            <span className="head-spacer" />
            <button
              className="copy-all"
              onClick={(e) => { e.stopPropagation(); copyAllQuestions(); }}
              title={window.t("s7_briefing_copy", lang)}
            >
              {copiedToast ? `✓ ${window.t("s7_briefing_copied", lang)}` : `⧉ ${window.t("s7_briefing_copy", lang)}`}
            </button>
            <button
              className="resummarize"
              onClick={(e) => { e.stopPropagation(); /* no-op stub for slice 1 */ }}
              title={window.t("s7_briefing_resummarize", lang)}
            >
              {window.t("s7_briefing_resummarize", lang)}
            </button>
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
              <span className="kbd">b</span>
            </span>
          </div>
          <div className="briefing-banner-body">
            {/* What this RolePack is — 3 bullets */}
            <div className="briefing-section what">
              <div className="briefing-section-head">{window.t("s7_briefing_what", lang)}</div>
              <ul className="briefing-list">
                {window.BRIEFING.what[lang].map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </div>

            {/* Strong + Thin two-column inner grid */}
            <div style={{ display: "grid", gap: 10 }}>
              <div className="briefing-section strong">
                <div className="briefing-section-head">{window.t("s7_briefing_strong", lang)}</div>
                <div className="briefing-list">
                  {window.BRIEFING.strong.map((s) => (
                    <button
                      key={s.fieldId}
                      className="briefing-chip strong"
                      onClick={(e) => jumpToField(s.fieldId, e.currentTarget)}
                      title={window.t("s7_briefing_jump", lang)}
                    >
                      <span style={{ fontWeight: 600, color: "var(--st-fill-ink)" }}>✓</span>
                      <span style={{ flex: 1 }}>{s.label[lang]}</span>
                      <span className="chip-arrow">→</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="briefing-section thin">
                <div className="briefing-section-head">{window.t("s7_briefing_thin", lang)}</div>
                <div className="briefing-list">
                  {window.BRIEFING.thin.map((t) => (
                    <button
                      key={t.fieldId}
                      className="briefing-chip thin"
                      onClick={(e) => jumpToField(t.fieldId, e.currentTarget)}
                      title={window.t("s7_briefing_jump", lang)}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{t.label[lang]}</span>
                        <span className="chip-why">{t.why[lang]}</span>
                      </div>
                      <span className="chip-arrow">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Suggested questions */}
            <div className="briefing-section" style={{ background: "white" }}>
              <div className="briefing-section-head" style={{ color: "var(--cop-border)" }}>
                {window.t("s7_briefing_questions", lang)}
              </div>
              <div className="briefing-list">
                {window.BRIEFING.questions.map((q, i) => (
                  <button
                    key={i}
                    className="briefing-chip"
                    style={{ alignItems: "flex-start" }}
                    onClick={(e) => jumpToField(q.fieldIds[0], e.currentTarget)}
                    title={window.t("s7_briefing_jump", lang)}
                  >
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      color: "var(--cop-border)", fontWeight: 700,
                      paddingTop: 2, minWidth: 14
                    }}>
                      Q{i + 1}
                    </span>
                    <span className="chip-q">{q.q[lang]}</span>
                    <span className="chip-arrow" style={{ paddingTop: 2 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="curator-shell">
        {/* ───────── Left pane: source ───────── */}
        <aside className="curator-pane">
          <div className="curator-section-head">{window.t("s7_pane_left", lang)}</div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>
              {window.t("s7_uploads", lang)}
            </div>
            <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
              {[
                { type: "PDF", name: "Vigil_TMX_Overview.pdf", size: "2.4 MB" },
                { type: "PPT", name: "TMX_Demo_Deck.pptx", size: "8.1 MB" },
                { type: "URL", name: "vigil.hk/products/tmx", size: "" },
                { type: "VOX", name: "wilson_intro_30s.m4a", size: "0.4 MB" },
              ].map((f, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", background: "var(--bg)",
                  border: "1px solid var(--line)", borderRadius: 6,
                  cursor: "pointer", transition: "background 0.12s",
                  fontSize: 12
                }}>
                  <span style={{
                    fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
                    padding: "2px 5px", borderRadius: 3,
                    background: "white", border: "1px solid var(--line)",
                    color: { PDF: "#DC2626", PPT: "#EA580C", URL: "#2563EB", VOX: "#7C3AED" }[f.type]
                  }}>{f.type}</span>
                  <span style={{ flex: 1, color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                    {f.name}
                  </span>
                  {f.size && <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{f.size}</span>}
                </div>
              ))}
            </div>

            <div style={{
              padding: 10, background: "var(--st-ai-bg)",
              border: "1px solid var(--st-ai-border)", borderRadius: 8,
              fontSize: 12, color: "var(--st-ai-ink)", marginBottom: 18
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                ✦ {window.t("s7_extract_conf", lang)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="conf-bar" style={{ width: 60, height: 5 }}>
                  <div className="conf-bar-fill" style={{ width: "65%", background: "var(--st-ai-ink)" }} />
                </div>
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>65%</span>
                <span style={{ opacity: 0.7 }}>· {lang === "zh" ? "AI 提取" : "AI extracted"}</span>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>
              {window.t("s7_chat", lang)}
            </div>
            <div style={{
              border: "1px solid var(--line)", borderRadius: 8, background: "var(--cop-bg)",
              padding: 10, fontSize: 12, display: "grid", gap: 6, lineHeight: 1.5
            }}>
              <div style={{ background: "white", padding: "6px 9px", borderRadius: 8, color: "var(--cop-ink)" }}>
                <strong>Copilot:</strong> {lang === "zh" ? "你的演示偏好和响应时间还没填,能告诉我吗?" : "Your demo preferences and response time aren't filled in — can you tell me?"}
              </div>
              <div style={{ background: "#EEF0F4", padding: "6px 9px", borderRadius: 8, marginLeft: 16, color: "var(--ink)" }}>
                {lang === "zh"
                  ? "线上 30 分钟标准演示,深度走查 90 分钟。工作日 4 小时内首次响应,P1 故障 1 小时内。"
                  : "30 min standard demo online, 90 min deep walkthrough. First response 4 business hours, P1 within 1 hour."}
              </div>
              <div style={{ background: "white", padding: "6px 9px", borderRadius: 8, color: "var(--cop-ink)" }}>
                <strong>Copilot:</strong> ✓ {lang === "zh" ? "已更新 3 个字段" : "Updated 3 fields"}
              </div>
            </div>
          </div>
        </aside>

        {/* ───────── Center pane: decomposition ───────── */}
        <main className="curator-pane">
          <div className="curator-section-head" style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setTab("decompose")} style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
              color: tab === "decompose" ? "var(--navy)" : "var(--ink-3)",
              background: tab === "decompose" ? "white" : "transparent",
              border: tab === "decompose" ? "1px solid var(--line)" : "1px solid transparent",
              textTransform: "uppercase", letterSpacing: "0.06em"
            }}>
              {window.t("s7_pane_center", lang)}
            </button>
            <button onClick={() => setTab("sales")} style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
              color: tab === "sales" ? "var(--navy)" : "var(--ink-3)",
              background: tab === "sales" ? "white" : "transparent",
              border: tab === "sales" ? "1px solid var(--line)" : "1px solid transparent",
              textTransform: "uppercase", letterSpacing: "0.06em"
            }}>
              {window.t("s7_sales", lang)}
            </button>
          </div>

          <div style={{ padding: 16 }}>
            {tab === "decompose" && (
              <>
                {/* Section A: Supplier vs AI */}
                <SubHead lang={lang} num="A" title={lang === "zh" ? "供应商填写 vs. AI 结构化提取" : "Supplier said vs. AI extracted"} />
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
                  border: "1px solid var(--line)", borderRadius: 8,
                  marginBottom: 24, fontSize: 12.5, overflow: "hidden"
                }}>
                  <div style={{ padding: 12, borderRight: "1px solid var(--line)", background: "#FAFAF7" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      {window.t("s7_supplier_said", lang)}
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <CompareItem fieldId="user_role"       label={lang === "zh" ? "目标用户" : "Target user"} value={lang === "zh" ? "AML 分析师" : "AML Analyst"} />
                      <CompareItem fieldId="pain_main"       label={lang === "zh" ? "主要痛点" : "Main pain"} value={lang === "zh" ? "误报率 40-60%,告警堆积" : "FP rate 40-60%, alerts pile up"} />
                      <CompareItem fieldId="do_capabilities" label={lang === "zh" ? "关键能力" : "Key capability"} value={lang === "zh" ? "规则 + CNN/LSTM 双引擎" : "Rules + CNN/LSTM dual engine"} />
                    </div>
                  </div>
                  <div style={{ padding: 12, background: "var(--st-ai-bg)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--st-ai-ink)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      ✦ {window.t("s7_ai_extracted", lang)}
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <CompareItem fieldId="user_role"        path="whoUses.role"           value={lang === "zh" ? "AML 分析师 (junior-mid)" : "AML Analyst (junior-mid)"} ai />
                      <CompareItem fieldId="pain_main"        path="problem.painMain"       value={lang === "zh" ? "rule-fp-rate=40-60%; alert-backlog=high" : "rule-fp-rate=40-60%; alert-backlog=high"} ai />
                      <CompareItem fieldId="do_capabilities"  path="capabilities[CAP-01]"   value={lang === "zh" ? "dual-mode-engine (rules+CNN/LSTM)" : "dual-mode-engine (rules+CNN/LSTM)"} ai />
                    </div>
                  </div>
                </div>

                {/* Section B: Three-layer */}
                <SubHead lang={lang} num="B" title={window.t("s7_three_layer", lang)} caption={lang === "zh" ? "(策展人内部视角)" : "(curator-internal view)"} />

                <div style={{ display: "flex", gap: 4, marginBottom: 12, fontSize: 12 }}>
                  {[
                    ["capabilities", "🛠️", window.t("s7_capabilities", lang), window.LAYERS.capabilities.length],
                    ["knowledge", "📚", window.t("s7_knowledge", lang), window.LAYERS.knowledge.length],
                    ["interfaces", "🔌", window.t("s7_interfaces", lang), window.LAYERS.interfaces.length],
                  ].map(([k, ic, lab, n]) => (
                    <button key={k} onClick={() => setLayerTab(k)}
                      style={{
                        padding: "8px 12px", borderRadius: 8,
                        background: layerTab === k ? "var(--navy)" : "white",
                        color: layerTab === k ? "white" : "var(--ink-2)",
                        border: layerTab === k ? "1px solid var(--navy)" : "1px solid var(--line)",
                        fontWeight: 500, fontSize: 12, display: "flex", alignItems: "center", gap: 6
                      }}>
                      {ic} {lab}
                      <span style={{
                        fontSize: 10, padding: "1px 6px", borderRadius: 999,
                        background: layerTab === k ? "rgba(255,255,255,0.2)" : "var(--bg)",
                        fontVariantNumeric: "tabular-nums"
                      }}>{n}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 6, marginBottom: 24 }}>
                  {cards.map(c => {
                    const cname = typeof c.name === "string" ? c.name : c.name[lang];
                    const cdesc = typeof c.desc === "string" ? c.desc : c.desc[lang];
                    return (
                      <div key={c.id} className="layer-card">
                        <span className="layer-id">{c.id}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "var(--navy-ink)", marginBottom: 2 }}>
                            {cname}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{cdesc}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <div className="conf-bar" title={`${Math.round(c.conf * 100)}% confidence`}>
                            <div className="conf-bar-fill" style={{
                              width: `${c.conf * 100}%`,
                              background: c.conf > 0.85 ? "var(--st-fill-ink)" : c.conf > 0.75 ? "var(--st-weak-ink)" : "var(--st-empty-ink)"
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                            {Math.round(c.conf * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <button style={{
                    padding: "8px 12px", border: "1px dashed var(--line)", borderRadius: 8,
                    fontSize: 12, color: "var(--ink-3)"
                  }}>
                    + {lang === "zh" ? "手动添加" : "Add card manually"}
                  </button>
                </div>

                {/* Section C: AI rec */}
                <SubHead lang={lang} num="C" title={lang === "zh" ? "组装建议" : "Assembly recommendation"} />

                <div style={{
                  border: "2px solid var(--cop-border)", borderRadius: 12, padding: 16,
                  background: "linear-gradient(180deg, rgba(107,63,160,0.05), rgba(107,63,160,0.01))",
                  marginBottom: 12
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--cop-border)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6
                  }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: "var(--cop-border)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✦</span>
                    🤖 {window.t("s7_ai_rec", lang)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cop-ink)", marginBottom: 8 }}>
                    {window.AI_REC.primary[lang]}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 12 }}>
                    {window.AI_REC.reasoning[lang]}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    {window.t("s7_alt", lang)}
                  </div>
                  <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12.5, color: "var(--ink-2)", display: "grid", gap: 4 }}>
                    {window.AI_REC.alternatives.map(a => (
                      <li key={a.id}><strong>{a.id})</strong> {a.label[lang]}</li>
                    ))}
                  </ul>
                </div>

                <div style={{
                  border: "2px solid var(--gold)", borderRadius: 12, padding: 16,
                  background: "rgba(201,169,97,0.05)"
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--navy-ink)", marginBottom: 10
                  }}>
                    📋 {window.t("s7_curator_dec", lang)}
                  </div>
                  <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                    {[
                      { val: "primary", label: window.AI_REC.primary[lang], badge: lang === "zh" ? "AI 推荐" : "AI rec" },
                      { val: "A", label: window.AI_REC.alternatives[0].label[lang] },
                      { val: "B", label: window.AI_REC.alternatives[1].label[lang] },
                      { val: "custom", label: lang === "zh" ? "自定义方案..." : "Custom decision..." },
                    ].map(o => (
                      <label key={o.val} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px",
                        background: recChoice === o.val ? "white" : "transparent",
                        border: `1px solid ${recChoice === o.val ? "var(--navy)" : "transparent"}`,
                        borderRadius: 6, cursor: "pointer", fontSize: 13
                      }}>
                        <input type="radio" checked={recChoice === o.val} onChange={() => setRecChoice(o.val)} />
                        <span style={{ flex: 1 }}>{o.label}</span>
                        {o.badge && <span className="status-badge ai">{o.badge}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === "sales" && (
              <div style={{ display: "grid", gap: 16 }}>
                <SalesBlock title={window.t("s7_onepager", lang)} lang={lang}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy-ink)", marginBottom: 6 }}>
                    {window.SALES.onepager_headline[lang]}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
                    {window.SALES.onepager_body[lang]}
                  </div>
                </SalesBlock>

                <SalesBlock title={window.t("s7_pitch_outline", lang)} lang={lang}>
                  <ol style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 4, fontSize: 13 }}>
                    {window.SALES.pitch_outline.map((p, i) => (
                      <li key={i} style={{ color: "var(--ink)" }}>{p[lang]}</li>
                    ))}
                  </ol>
                </SalesBlock>

                <SalesBlock title={window.t("s7_faq", lang) + ` (${window.SALES.faq.length})`} lang={lang}>
                  <div style={{ display: "grid", gap: 4 }}>
                    {window.SALES.faq.map((f, i) => (
                      <div key={i}>
                        <button
                          onClick={() => setExpandedFAQ(expandedFAQ === i ? -1 : i)}
                          style={{
                            width: "100%", textAlign: "left", padding: "8px 10px",
                            background: expandedFAQ === i ? "var(--bg)" : "transparent",
                            border: "1px solid var(--line)", borderRadius: 6,
                            fontSize: 13, fontWeight: 500, color: "var(--navy-ink)",
                            display: "flex", alignItems: "center", gap: 8
                          }}>
                          <span style={{
                            transform: expandedFAQ === i ? "rotate(90deg)" : "rotate(0)",
                            transition: "transform 0.18s", color: "var(--ink-3)"
                          }}>›</span>
                          {f.q[lang]}
                        </button>
                        {expandedFAQ === i && (
                          <div style={{
                            padding: "10px 14px 10px 26px", fontSize: 13, color: "var(--ink-2)",
                            lineHeight: 1.6
                          }}>
                            {f.a[lang]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SalesBlock>

                <SalesBlock title={window.t("s7_script", lang)} lang={lang}>
                  <div style={{
                    background: "var(--bg)", padding: 12, borderRadius: 6,
                    fontSize: 13, color: "var(--ink)", lineHeight: 1.65, fontStyle: "italic"
                  }}>
                    "{window.SALES.script_30s[lang]}"
                  </div>
                </SalesBlock>

                <SalesBlock title={window.t("s7_discovery", lang)} lang={lang}>
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 4, fontSize: 13 }}>
                    {window.SALES.discovery.map((q, i) => (
                      <li key={i} style={{ color: "var(--ink)" }}>{q[lang]}</li>
                    ))}
                  </ul>
                </SalesBlock>
              </div>
            )}
          </div>
        </main>

        {/* ───────── Right pane: actions ───────── */}
        <aside className="curator-pane" style={{ background: "white" }}>
          <div className="curator-section-head">{window.t("s7_pane_right", lang)}</div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>
              {window.t("s7_status", lang)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 18 }}>
              {[
                ["approve", window.t("s7_approve", lang), "var(--st-fill-ink)"],
                ["request", window.t("s7_request", lang), "var(--st-empty-ink)"],
                ["hold", window.t("s7_hold", lang), "var(--ink-3)"],
              ].map(([v, lab, color]) => (
                <button key={v} onClick={() => setDecision(v)} style={{
                  padding: "8px 6px", fontSize: 12, fontWeight: 600,
                  border: `1px solid ${decision === v ? color : "var(--line)"}`,
                  background: decision === v ? `${color}15` : "white",
                  color: decision === v ? color : "var(--ink-2)",
                  borderRadius: 6
                }}>
                  {lab}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>
              {window.t("s7_checks", lang)}
            </div>
            <div style={{ display: "grid", gap: 4, marginBottom: 18 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
                <label key={n} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                  background: checks[i] ? "var(--st-fill-bg)" : "var(--bg)",
                  fontSize: 12.5, lineHeight: 1.4
                }}>
                  <input
                    type="checkbox" checked={checks[i]}
                    onChange={(e) => {
                      const next = [...checks]; next[i] = e.target.checked; setChecks(next);
                    }}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ color: checks[i] ? "var(--st-fill-ink)" : "var(--ink-2)", flex: 1 }}>
                    {window.t(`s7_check${n}`, lang)}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>
              {window.t("s7_comments", lang)}
            </div>
            <textarea
              className="text-input"
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={lang === "zh" ? "可在此与供应商沟通..." : "Message to supplier..."}
              style={{ fontSize: 13, marginBottom: 18, resize: "vertical" }}
            />

            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>
              {window.t("s7_audit", lang)}
            </div>
            <div style={{
              border: "1px solid var(--line)", borderRadius: 8, padding: 10,
              fontSize: 11.5, color: "var(--ink-2)", display: "grid", gap: 6,
              fontFamily: "var(--font-mono)", marginBottom: 18
            }}>
              {window.AUDIT_LOG.map((a, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, lineHeight: 1.4 }}>
                  <span style={{ color: "var(--ink-3)" }}>{a.time.slice(5)}</span>
                  <span><strong style={{ color: "var(--navy-ink)" }}>{a.who}</strong> {typeof a.action === "string" ? a.action : a.action[lang]}</span>
                </div>
              ))}
            </div>

            <button
              className="btn btn-gold"
              disabled={!allChecked}
              onClick={goNext}
              style={{ width: "100%", padding: "12px 16px", fontWeight: 600 }}
              title={!allChecked ? window.t("s7_publish_disabled", lang) : ""}
            >
              {allChecked ? window.t("s7_publish", lang) + " →" : window.t("s7_publish_disabled", lang)}
            </button>
          </div>
        </aside>
      </div>

      {/* ───────── Call-date prompt (Slice 1) ───────── */}
      {showCallModal && (
        <div className="phase-modal-backdrop" onClick={() => setShowCallModal(false)}>
          <div className="phase-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{window.t("s7_phase_call_prompt", lang)}</h3>
            <div className="sub">{window.t("s7_phase_call_prompt_sub", lang)}</div>
            <input
              type="date"
              value={pendingCallDate}
              onChange={(e) => setPendingCallDate(e.target.value)}
              autoFocus
            />
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setShowCallModal(false)}>
                {window.t("s7_phase_call_cancel", lang)}
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmCallDate}
                disabled={!pendingCallDate}
              >
                {window.t("s7_phase_call_set", lang)} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubHead({ num, title, caption, lang }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)",
        background: "var(--bg)", padding: "1px 6px", borderRadius: 4
      }}>{num}</span>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-ink)", margin: 0 }}>
        {title}
      </h3>
      {caption && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{caption}</span>}
    </div>
  );
}

function CompareItem({ label, value, path, ai, fieldId }) {
  return (
    <div data-field-id={fieldId || undefined} style={{ padding: 4, margin: -4, borderRadius: 6 }}>
      <div style={{
        fontSize: 10, color: ai ? "var(--st-ai-ink)" : "var(--ink-3)",
        fontFamily: ai ? "var(--font-mono)" : "inherit",
        textTransform: ai ? "lowercase" : "none",
        marginBottom: 2, fontWeight: ai ? 500 : 400
      }}>
        {label || path}
      </div>
      <div style={{ color: "var(--ink)", fontSize: 12.5, lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

function SalesBlock({ title, children, lang }) {
  return (
    <div style={{
      background: "white", border: "1px solid var(--line)", borderRadius: 10, padding: 16
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
          color: "var(--ink-3)"
        }}>{title}</div>
        <button style={{
          fontSize: 11, padding: "3px 8px", borderRadius: 4,
          color: "var(--cop-border)", border: "1px solid #D8C9EC",
          background: "var(--cop-bg)", fontWeight: 500
        }}>
          ✦ {window.t("s7_regen", lang)}
        </button>
      </div>
      {children}
    </div>
  );
}

Object.assign(window, { ScreenWorkbench });
