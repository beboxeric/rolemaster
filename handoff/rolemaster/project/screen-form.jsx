// Screen 4 — intake form + Copilot. The centerpiece.
// Layout: form (left) + Copilot panel (right) on desktop.

const { useState: uS4, useEffect: uE4, useRef: uR4, useMemo: uM4 } = React;

const SECTION_META = [
  // Section 1 (company basics) is rendered as a separate card above the product tabs.
  { num: 2, key: "sec2", icon: "👤" },
  { num: 3, key: "sec3", icon: "💼" },
  { num: 4, key: "sec4", icon: "🎯" },
  { num: 5, key: "sec5", icon: "⚙" },
  { num: 6, key: "sec6", icon: "🌐" },
  { num: 7, key: "sec7", icon: "🤝" },
  { num: 8, key: "sec8", icon: "💰" },
];

function valueOf(v, lang) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v[lang] || v.en || "";
  return String(v);
}

// ───────── Field row ─────────
function FieldRow({ id, field, lang, onUpdate, isPulsing, scrollTo }) {
  const ref = uR4(null);
  uE4(() => {
    if (scrollTo === id && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [scrollTo, id]);

  const display = valueOf(field.value, lang);
  const isLong = display.length > 50;
  const InputEl = isLong ? "textarea" : "input";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label className="field-label" style={{ marginBottom: 0 }}>
          {field.label[lang]}
          {!field.optional && field.status !== "ai" && field.status !== "filled" && (
            <span style={{ color: "var(--ink-3)", marginLeft: 4 }}>·</span>
          )}
        </label>
        <span className={`status-badge ${field.status}`}>
          {field.status === "ai" && "✦ "}{field.status === "filled" && "✓ "}
          {window.t("status_" + (field.status === "ai" ? "ai" : field.status === "filled" ? "filled" : field.status === "empty" ? "empty" : "weak"), lang)}
        </span>
      </div>
      <InputEl
        className={`text-input field-input ${field.status} ${isPulsing ? "field-pulse" : ""}`}
        value={display}
        placeholder={field.status === "empty" ? (lang === "zh" ? "（暂无内容)" : "(no content yet)") : ""}
        rows={isLong ? 2 : undefined}
        style={isLong ? { resize: "vertical", minHeight: 56, fontSize: 13.5 } : { fontSize: 13.5 }}
        onChange={(e) => onUpdate(id, e.target.value)}
        onFocus={(e) => e.target.select && e.target.value && setTimeout(() => {
          // light focus highlight
        })}
      />
      {field.hint && field.status === "weak" && (
        <div style={{ fontSize: 11, color: "var(--st-weak-ink)", marginTop: 4, fontStyle: "italic" }}>
          💡 {field.hint[lang]}
        </div>
      )}
    </div>
  );
}

// ───────── Section card ─────────
function SectionCard({ meta, fields, lang, fieldsState, onUpdate, pulseSet, scrollTo }) {
  const [open, setOpen] = uS4(true);
  const sectionFields = Object.entries(fieldsState).filter(([k, f]) => f.section === meta.num);
  const filled = sectionFields.filter(([, f]) => f.status === "filled" || f.status === "ai").length;
  const total = sectionFields.length;
  const hasWeak = sectionFields.some(([, f]) => f.status === "weak");
  const hasEmpty = sectionFields.some(([, f]) => f.status === "empty");

  const sectionStatus = hasWeak || hasEmpty ? "attention" : "complete";
  const statusBadge = total === 0 ? "notstarted" : sectionStatus;

  uE4(() => {
    // auto-open the section that contains scrollTo target
    const target = scrollTo && fieldsState[scrollTo];
    if (target && target.section === meta.num) setOpen(true);
  }, [scrollTo]);

  return (
    <div className="section-card">
      <div className="section-header" onClick={() => setOpen(!open)}>
        <div className="section-icon">{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="section-title">{window.t(meta.key, lang)}</h3>
          <div className="section-desc">{window.t(meta.key + "_desc", lang)}</div>
        </div>
        <div className="section-meta">
          <span className={`status-badge ${statusBadge === "complete" ? "filled" : statusBadge === "attention" ? "weak" : "empty"}`}>
            {statusBadge === "complete" && "✓ "}
            {window.t("status_" + statusBadge, lang)}
          </span>
          <span className="section-count">{filled}/{total}</span>
          <span style={{
            color: "var(--ink-3)", fontSize: 13,
            transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.18s"
          }}>›</span>
        </div>
      </div>
      {open && (
        <div className="section-body">
          {sectionFields.map(([id, field]) => (
            <FieldRow
              key={id} id={id} field={field} lang={lang}
              onUpdate={onUpdate}
              isPulsing={pulseSet && pulseSet.has(id)}
              scrollTo={scrollTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ───────── Copilot Panel ─────────
function CopilotPanel({ lang, fieldsState, onCopilotFill, onScrollTo }) {
  const [messages, setMessages] = uS4(() => {
    const emptyCount = Object.values(fieldsState).filter(f => f.status === "empty" || f.status === "weak").length;
    return [
      {
        role: "bot",
        content: window.t("copilot_greet", lang, { n: emptyCount }),
        chips: ["copilot_walk", "copilot_scan"]
      }
    ];
  });
  const [input, setInput] = uS4("");
  const [thinking, setThinking] = uS4(false);
  const scrollRef = uR4(null);

  uE4(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  // Update greeting message when language changes
  uE4(() => {
    setMessages(prev => prev.map((m, i) => {
      if (i === 0 && m.role === "bot") {
        const emptyCount = Object.values(fieldsState).filter(f => f.status === "empty" || f.status === "weak").length;
        return { ...m, content: window.t("copilot_greet", lang, { n: emptyCount }) };
      }
      return m;
    }));
  }, [lang]);

  const handleSend = (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text };
    const detectedLang = /[\u4e00-\u9fa5]/.test(text) ? "zh" : "en";

    setMessages(m => [...m, userMsg]);
    setInput("");
    setThinking(true);

    // Mock AI response: detect intent in user message and update fields
    setTimeout(() => {
      // Look for keywords in user input to decide which fields to fill.
      // For demo, treat any substantive message as "fills the empty fields in section 7 + svc fields"
      const updates = pickUpdatesFor(text, fieldsState);
      const detail = detectedLang === "zh"
        ? `好的,我从你这段话里整理出了 ${updates.length} 处更新:`
        : `Got it — I parsed ${updates.length} updates from that:`;

      const fieldNames = updates.map(u => fieldsState[u.id].label[detectedLang]);
      setMessages(m => [...m, {
        role: "bot",
        content: detail,
        fillList: updates.map(u => ({ id: u.id, name: u.label[detectedLang] })),
        followup: detectedLang === "zh"
          ? "如果有补充,告诉我;否则我们继续看其他空缺。"
          : "Add anything else if you'd like — otherwise we'll keep moving."
      }]);
      onCopilotFill(updates);
      setThinking(false);

      // Add system msg
      setTimeout(() => {
        setMessages(m => [...m, {
          role: "system",
          content: window.t("copilot_updated_n", detectedLang, { n: updates.length })
        }]);
      }, 300);
    }, 1100);
  };

  return (
    <div style={{
      width: 380, flexShrink: 0,
      background: "white",
      borderLeft: "1px solid var(--line)",
      display: "flex", flexDirection: "column",
      height: "100%"
    }}>
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "center", gap: 10
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--cop-border)", color: "white",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 14
        }}>
          ✦
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cop-ink)" }}>
            {lang === "zh" ? "Copilot" : "Copilot"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {lang === "zh" ? "我会帮你边聊边填" : "I'll fill fields as we chat"}
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", padding: "16px",
        display: "flex", flexDirection: "column", gap: 10
      }}>
        {messages.map((m, i) => {
          if (m.role === "system") {
            return <div key={i} className="system-msg">{m.content}</div>;
          }
          return (
            <div key={i} style={{
              display: "flex", flexDirection: "column",
              alignItems: m.role === "bot" ? "flex-start" : "flex-end",
              gap: 6
            }}>
              {m.role === "bot" && (
                <div style={{ fontSize: 10, color: "var(--cop-border)", fontWeight: 600, marginLeft: 4, letterSpacing: "0.04em" }}>
                  COPILOT
                </div>
              )}
              <div className={`bubble ${m.role}`}>
                {m.content}
                {m.fillList && (
                  <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                    {m.fillList.map((f, j) => (
                      <li key={j} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ color: "var(--st-fill-ink)" }}>✓</span>
                        <button className="field-link" onClick={() => onScrollTo(f.id)}>{f.name}</button>
                      </li>
                    ))}
                  </ul>
                )}
                {m.followup && <div style={{ marginTop: 8, fontSize: 12.5, opacity: 0.85 }}>{m.followup}</div>}
              </div>
              {m.chips && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {m.chips.map(c => (
                    <button key={c}
                      onClick={() => handleSend(window.t(c, lang))}
                      style={{
                        fontSize: 12, padding: "5px 10px",
                        background: "white", border: "1px solid #D8C9EC",
                        borderRadius: 999, color: "var(--cop-border)",
                        fontWeight: 500
                      }}
                    >
                      {window.t(c, lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {thinking && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <div style={{ fontSize: 10, color: "var(--cop-border)", fontWeight: 600, marginLeft: 4, letterSpacing: "0.04em" }}>
              COPILOT
            </div>
            <div className="bubble bot" style={{ padding: "10px 14px" }}>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--cop-ink)", opacity: 0.7 }}>
                {window.t("copilot_thinking", lang)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid var(--line)", background: "white" }}>
        <div style={{
          background: "white", borderRadius: 12,
          border: "1px solid #D8C9EC",
          padding: 10, display: "flex", alignItems: "flex-end", gap: 8
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder={window.t("copilot_input_ph", lang)}
            rows={2}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              fontSize: 13, lineHeight: 1.4, fontFamily: "inherit",
              background: "transparent"
            }}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim()}
            style={{
              background: "var(--cop-border)", color: "white",
              padding: "8px 14px", borderRadius: 8, fontWeight: 500, fontSize: 12
            }}
          >
            {window.t("copilot_send", lang)}
          </button>
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 8, textAlign: "center" }}>
          {lang === "zh"
            ? "提示:一段话可以同时回答多个问题 · Shift+Enter 换行"
            : "Tip: one paragraph can answer multiple questions · Shift+Enter for new line"}
        </div>
      </div>
    </div>
  );
}

// Smart pick: which fields to update from a user message. For mockup we
// detect a few keywords; if none match, pick currently-empty/weak fields.
function pickUpdatesFor(text, state) {
  const lower = text.toLowerCase();
  const isZh = /[\u4e00-\u9fa5]/.test(text);
  const updates = [];

  // Demo pattern 1: user mentions demo / sales / response → fill svc_*
  if (lower.includes("demo") || lower.includes("演示") || lower.includes("销售") || lower.includes("response") || lower.includes("响应") || lower.includes("budget") || lower.includes("预算") || text.length > 30) {
    if (state.svc_demo && state.svc_demo.status === "empty") {
      updates.push({
        id: "svc_demo", status: "filled",
        value: isZh
          ? "线上 30 分钟产品演示;客户感兴趣后可安排 90 分钟深度 POC 走查"
          : "30-min online product demo; deeper 90-min POC walkthrough on request",
        label: state.svc_demo.label
      });
    }
    if (state.svc_response && state.svc_response.status === "empty") {
      updates.push({
        id: "svc_response", status: "filled",
        value: isZh
          ? "工作日 4 小时内首次响应;P1 故障 1 小时内"
          : "First response within 4 business hours; P1 incidents within 1 hour",
        label: state.svc_response.label
      });
    }
    if (state.buyer_budget && state.buyer_budget.status === "empty") {
      updates.push({
        id: "buyer_budget", status: "filled",
        value: isZh
          ? "中型机构年化 80-150 万 HKD,大行可至 300 万+"
          : "HKD 800K-1.5M annually for mid-tier; HKD 3M+ for large banks",
        label: state.buyer_budget.label
      });
    }
    // Also strengthen the weak field
    if (state.user_seniority && state.user_seniority.status === "weak") {
      updates.push({
        id: "user_seniority", status: "filled",
        value: isZh
          ? "初级到中级 AML 分析师 (1-5 年经验),少量高级分析师监督"
          : "Junior to mid AML analysts (1-5 yrs experience); senior analysts in oversight",
        label: state.user_seniority.label
      });
    }
  }

  // Fallback: just pick first 2 empty/weak
  if (updates.length === 0) {
    Object.entries(state).forEach(([id, f]) => {
      if (updates.length >= 2) return;
      if (f.status === "empty" || f.status === "weak") {
        updates.push({
          id, status: "filled",
          value: isZh ? "（已根据你刚才的描述更新)" : "(updated from your description)",
          label: f.label
        });
      }
    });
  }

  return updates.slice(0, 5);
}

// ───────── Top-level Screen 4 ─────────
function ScreenForm({ lang, setLang, goNext }) {
  const [activeProduct, setActiveProduct] = uS4("TMX");
  const [copilotOpen, setCopilotOpen] = uS4(true);
  const [scrollTo, setScrollTo] = uS4(null);
  const [pulse, setPulse] = uS4(null);
  const [pulseAll, setPulseAll] = uS4(null);

  // Field state — clone of FIELDS so we can mutate it
  const [fieldsState, setFieldsState] = uS4(() => {
    const out = {};
    Object.entries(window.FIELDS).forEach(([k, v]) => { out[k] = { ...v }; });
    return out;
  });

  const handleUpdate = (id, newValue) => {
    setFieldsState(prev => ({
      ...prev,
      [id]: { ...prev[id], value: newValue, status: newValue ? "filled" : "empty" }
    }));
  };

  const handleCopilotFill = (updates) => {
    // Stage the wave: all fields pulse together after a short delay
    const ids = updates.map(u => u.id);
    setPulseAll(ids);
    setFieldsState(prev => {
      const next = { ...prev };
      updates.forEach(u => {
        next[u.id] = { ...next[u.id], value: u.value, status: u.status };
      });
      return next;
    });
    // Trigger a synchronized wave pulse
    setTimeout(() => setPulseAll(null), 1500);
    // scroll to first updated field
    if (ids.length) setScrollTo(ids[0]);
  };

  // Compute progress (excluding section 1 = company basics, which lives in its own card)
  const productFields = Object.values(fieldsState).filter(f => f.section !== 1);
  const totalFields = productFields.length;
  const filledCount = productFields.filter(f => f.status === "filled" || f.status === "ai").length;
  const progress = Math.round(filledCount / totalFields * 100);

  // Company card collapsed/expanded state
  const [companyOpen, setCompanyOpen] = uS4(false);
  const companyFields = Object.entries(fieldsState).filter(([, f]) => f.section === 1);
  const companyFilled = companyFields.filter(([, f]) => f.status === "filled" || f.status === "ai").length;

  // Per-product progress for the strip
  const progressStrip = window.PRODUCTS.map(p => ({
    ...p,
    pct: p.id === "TMX" ? progress : p.progress
  }));

  const productLabel = (() => {
    const p = window.PRODUCTS.find(x => x.id === activeProduct);
    return p ? `${p.name} — ${p.subtitle[lang]}` : "";
  })();

  return (
    <div className="screen-anim platform-supplier" style={{
      display: "flex", flexDirection: "column", height: "100vh"
    }}>
      <div className="gold-line" />
      <AppHeader lang={lang} setLang={setLang} productLabel={productLabel}
        savedAt={lang === "zh" ? "1 分钟前" : "1 min ago"} progress={progress} />

      {/* Company-wide card — entered once, applies to every product */}
      <div style={{
        margin: "16px 24px 0", maxWidth: 1280, alignSelf: "center", width: "calc(100% - 48px)"
      }}>
        <div style={{
          background: "linear-gradient(180deg, rgba(31,58,95,0.04), rgba(31,58,95,0.01))",
          border: "1px solid var(--line)",
          borderLeft: "3px solid var(--navy)",
          borderRadius: 10,
          overflow: "hidden"
        }}>
          <div
            onClick={() => setCompanyOpen(!companyOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 18px",
              cursor: "pointer"
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "var(--navy)", color: "white",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 16
            }}>🏢</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-ink)" }}>
                {window.t("sec1", lang)}
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 500,
                  color: "var(--ink-3)", background: "white",
                  padding: "2px 8px", borderRadius: 999, border: "1px solid var(--line)"
                }}>
                  {lang === "zh" ? "全公司共用 · 录入一次" : "Company-wide · enter once"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>
                {companyOpen
                  ? window.t("sec1_desc", lang)
                  : (() => {
                      const name = valueOf(fieldsState.company_name?.value, lang);
                      const hq = valueOf(fieldsState.company_hq?.value, lang);
                      const team = valueOf(fieldsState.company_team?.value, lang);
                      return [name, hq, team].filter(Boolean).join(" · ");
                    })()
                }
              </div>
            </div>
            <span className="status-badge filled">
              ✓ {companyFilled}/{companyFields.length} {lang === "zh" ? "已填" : "filled"}
            </span>
            <span style={{
              color: "var(--ink-3)", fontSize: 14,
              transform: companyOpen ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 0.18s"
            }}>›</span>
          </div>
          {companyOpen && (
            <div style={{
              padding: "4px 18px 18px",
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14
            }}>
              {companyFields.map(([id, field]) => (
                <FieldRow
                  key={id} id={id} field={field} lang={lang}
                  onUpdate={handleUpdate}
                  isPulsing={false}
                  scrollTo={scrollTo}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tab-strip">
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 8, alignSelf: "center" }}>
          {lang === "zh" ? "产品" : "Products"}
        </span>
        {window.PRODUCTS.map(p => (
          <button
            key={p.id}
            className={
              "product-tab" +
              (p.id === activeProduct ? " active" : "") +
              (p.progress >= 100 ? " complete" : "")
            }
            onClick={() => setActiveProduct(p.id)}
          >
            <span className="tab-name">
              {p.id === activeProduct && <span className="tab-status-dot" />}
              {p.name}
            </span>
            <span className="tab-sub">{p.subtitle[lang]}</span>
          </button>
        ))}
        <button style={{
          padding: "8px 14px", borderRadius: 8, fontSize: 13,
          color: "var(--ink-3)", border: "1px dashed var(--line)",
          minWidth: 130
        }}>
          + {window.t("add_product", lang)}
        </button>
      </div>

      <div className="sub-status">
        <span style={{ fontWeight: 600, color: "var(--navy-ink)" }}>
          {lang === "zh" ? "正在编辑:" : "Currently:"} {productLabel}
        </span>
        <div className="progress-strip">
          {progressStrip.map(p => (
            <span key={p.id} className={"strip-item " + (p.id === activeProduct ? "active" : p.pct === 100 ? "done" : "")}>
              {p.name} {p.pct}%
            </span>
          ))}
        </div>
        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          className="btn"
          style={{
            background: copilotOpen ? "white" : "var(--cop-border)",
            color: copilotOpen ? "var(--cop-border)" : "white",
            border: `1px solid ${copilotOpen ? "var(--cop-border)" : "transparent"}`,
            padding: "6px 12px", fontSize: 12, fontWeight: 600
          }}
        >
          {copilotOpen ? "✕ " + window.t("copilot_close", lang) : "✦ " + window.t("copilot_btn", lang)}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--bg)" }}>
        {/* Form panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 80px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {SECTION_META.map(meta => (
              <SectionCard
                key={meta.num} meta={meta}
                lang={lang}
                fieldsState={fieldsState}
                onUpdate={handleUpdate}
                pulseSet={pulseAll ? new Set(pulseAll) : (pulse ? new Set([pulse]) : null)}
                scrollTo={scrollTo}
              />
            ))}

            {/* Submit button */}
            <div style={{
              display: "flex", justifyContent: "flex-end", marginTop: 24, gap: 12,
              alignItems: "center"
            }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {filledCount} / {totalFields} {lang === "zh" ? "已完成" : "complete"}
              </span>
              <button
                className="btn btn-primary"
                onClick={goNext}
                style={{ padding: "12px 24px", fontWeight: 600 }}
              >
                {window.t("submit_btn", lang)} →
              </button>
            </div>
          </div>
        </div>

        {/* Copilot panel */}
        {copilotOpen && (
          <CopilotPanel
            lang={lang}
            fieldsState={fieldsState}
            onCopilotFill={handleCopilotFill}
            onScrollTo={(id) => { setScrollTo(id); setPulse(id); setTimeout(() => setPulse(null), 1500); }}
          />
        )}
      </div>
    </div>
  );
}

// Hack: render pulse on every field that's in pulseAll
// We patch FieldRow's pulse prop interpretation: if pulseAll is array, check membership
// Already handled — SectionCard passes a single id to pulse; let's pass the full array instead.
// (Quick patch: rewire SectionCard to forward array.)

Object.assign(window, { ScreenForm });
