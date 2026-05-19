// Screen 1: Registration. Functional but minimal per priority.
// Screen 2: Upload — polished. Screen 3: Multi-product — polished.

const { useState: uS1, useEffect: uE1, useRef: uR1 } = React;

// ─────────────────────────────────────────────────────────────────────
function ScreenRegister({ lang, setLang, goNext }) {
  const [submitted, setSubmitted] = uS1(false);
  const [form, setForm] = uS1({
    company: "", hq: "", contact: "", email: "", phone: "", terms: false
  });
  const [errors, setErrors] = uS1({});

  const onSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.company) errs.company = true;
    if (!form.hq) errs.hq = true;
    if (!form.contact) errs.contact = true;
    if (!form.email || !form.email.includes("@")) errs.email = true;
    if (!form.terms) errs.terms = true;
    setErrors(errs);
    if (Object.keys(errs).length === 0) setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="screen-anim platform-supplier" style={{
        minHeight: "100vh", display: "flex", flexDirection: "column"
      }}>
        <AppHeader lang={lang} setLang={setLang} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          maxWidth: 460, textAlign: "center", padding: 40,
          background: "white", border: "1px solid var(--line)", borderRadius: 16
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--st-fill-bg)", color: "var(--st-fill-ink)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, marginBottom: 16
          }}>✉</div>
          <h2 style={{ fontSize: 22, margin: "0 0 8px", color: "var(--navy-ink)" }}>
            {window.t("s1_check_email", lang)}
          </h2>
          <p style={{ color: "var(--ink-2)", margin: "0 0 24px", lineHeight: 1.6 }}>
            {window.t("s1_check_email_sub", lang, { email: form.email || "wilson@vigil.hk" })}
          </p>
          <button className="btn btn-primary" onClick={goNext}>
            {lang === "zh" ? "（演示)模拟点击邮件链接 →" : "(Demo) simulate magic-link click →"}
          </button>
          <div style={{ marginTop: 16, fontSize: 12, color: "var(--ink-3)" }}>
            <button className="btn-ghost" style={{ padding: "4px 8px" }}>
              {window.t("s1_resend", lang)}
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-anim platform-supplier" style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column"
    }}>
      <AppHeader lang={lang} setLang={setLang} />
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px"
      }}>
        <form onSubmit={onSubmit} style={{
          maxWidth: 480, width: "100%",
          background: "white", border: "1px solid var(--line)",
          borderRadius: 16, padding: 36
        }}>
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: "var(--navy-ink)",
            margin: "0 0 6px", letterSpacing: "-0.01em"
          }}>{window.t("s1_heading", lang)}</h1>
          <p style={{ color: "var(--ink-2)", margin: "0 0 28px", fontSize: 14 }}>
            {window.t("s1_sub", lang)}
          </p>

          {[
            ["company", "s1_company", "s1_company_ph"],
            ["hq", "s1_hq", "s1_hq_ph"],
            ["contact", "s1_contact", "s1_contact_ph"],
            ["email", "s1_email", null, "email"],
            ["phone", "s1_phone", null, "tel", true]
          ].map(([key, labKey, phKey, type = "text", optional]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label className="field-label">
                {window.t(labKey, lang)}
                {!optional && <span style={{ color: "var(--st-empty-ink)", marginLeft: 4 }}>*</span>}
              </label>
              <input
                type={type}
                className="text-input"
                placeholder={phKey ? window.t(phKey, lang) : ""}
                value={form[key]}
                onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={errors[key] ? { borderColor: "var(--st-empty-ink)" } : {}}
              />
              {errors[key] && (
                <div style={{ fontSize: 11, color: "var(--st-empty-ink)", marginTop: 4 }}>
                  {lang === "zh" ? "请填写此项" : "Required"}
                </div>
              )}
            </div>
          ))}

          <label style={{
            display: "flex", alignItems: "flex-start", gap: 8, marginTop: 20,
            fontSize: 13, color: "var(--ink-2)", cursor: "pointer"
          }}>
            <input
              type="checkbox" checked={form.terms}
              onChange={(e) => setForm(f => ({ ...f, terms: e.target.checked }))}
              style={{ marginTop: 2 }}
            />
            <span>
              {window.t("s1_terms", lang)} <a href="#">{window.t("s1_terms_link", lang)}</a>
            </span>
          </label>
          {errors.terms && (
            <div style={{ fontSize: 11, color: "var(--st-empty-ink)", marginTop: 4, marginLeft: 24 }}>
              {lang === "zh" ? "请勾选同意条款" : "Please agree to the terms"}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 24, padding: "12px 18px" }}>
            {window.t("s1_continue", lang)}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function ScreenOnboard({ lang, setLang, goNext }) {
  const [parsing, setParsing] = uS1(false);
  const [hover, setHover] = uS1(false);
  const [progress, setProgress] = uS1(0);

  uE1(() => {
    if (!parsing) return;
    let p = 0;
    const id = setInterval(() => {
      p += 6 + Math.random() * 12;
      if (p >= 100) {
        p = 100;
        clearInterval(id);
        setTimeout(() => goNext(), 400);
      }
      setProgress(p);
    }, 180);
    return () => clearInterval(id);
  }, [parsing]);

  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    setParsing(true);
  };

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader lang={lang} setLang={setLang} />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 640, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--navy-ink)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            {window.t("s2_welcome", lang)}, {window.SUPPLIER.shortName}
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: 15, margin: "0 0 36px", lineHeight: 1.55 }}>
            {window.t("s2_sub", lang)}
          </p>

          {!parsing ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setHover(true); }}
                onDragLeave={() => setHover(false)}
                onDrop={onDrop}
                onClick={() => setParsing(true)}
                style={{
                  border: `2px dashed ${hover ? "var(--navy)" : "var(--line)"}`,
                  borderRadius: 16,
                  background: hover ? "rgba(31,58,95,0.04)" : "white",
                  padding: "56px 32px",
                  cursor: "pointer",
                  transition: "all 0.18s",
                  position: "relative"
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "var(--st-ai-bg)", color: "var(--st-ai-ink)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--navy-ink)", marginBottom: 6 }}>
                  {window.t("s2_drop", lang)}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  {window.t("s2_drop_sub", lang)}
                </div>
                {/* Sample uploaded file pills (decorative — show this looks alive) */}
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
                  {[
                    { type: "PDF", name: "Vigil_TMX_Overview.pdf" },
                    { type: "PPT", name: "TMX_Demo_Deck.pptx" },
                    { type: "URL", name: "vigil.hk/products" },
                  ].map((f, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: "4px 10px", background: "white",
                      border: "1px solid var(--line)", borderRadius: 999, color: "var(--ink-2)",
                      fontFamily: "var(--font-mono)"
                    }}>
                      <span style={{ color: "var(--navy-2)", fontWeight: 600, marginRight: 6 }}>{f.type}</span>
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 24, fontSize: 13, color: "var(--ink-2)" }}>
                {window.t("s2_or", lang)}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-secondary">+ {window.t("s2_url", lang)}</button>
                <button className="btn btn-secondary">+ {window.t("s2_text", lang)}</button>
                <button className="btn btn-secondary">+ {window.t("s2_voice", lang)}</button>
              </div>

              <div style={{
                marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)",
                fontSize: 13, color: "var(--ink-2)"
              }}>
                {window.t("s2_no_materials", lang)}{" "}
                <button onClick={() => setParsing(true)} style={{
                  color: "var(--navy-2)", textDecoration: "underline", padding: 0
                }}>
                  {window.t("s2_qa_instead", lang)}
                </button>
              </div>
            </>
          ) : (
            <div style={{
              padding: 40, background: "white", borderRadius: 16,
              border: "1px solid var(--line)", maxWidth: 480, margin: "0 auto"
            }}>
              <div style={{
                fontSize: 16, fontWeight: 600, color: "var(--navy-ink)", marginBottom: 6
              }}>{window.t("s2_parsing", lang)}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
                {window.t("s2_parsing_sub", lang)}
              </div>
              <div style={{ height: 6, background: "var(--line-2)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--navy-2), var(--gold))",
                  transition: "width 0.18s ease-out"
                }} />
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: "var(--ink-2)", textAlign: "left", display: "grid", gap: 6 }}>
                {[
                  { z: "解析 Vigil_TMX_Overview.pdf", e: "Parsing Vigil_TMX_Overview.pdf" },
                  { z: "提取产品信息与能力点", e: "Extracting product info and capabilities" },
                  { z: "识别多产品结构", e: "Detecting multi-product structure" },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    opacity: progress > i * 33 ? 1 : 0.4,
                    transition: "opacity 0.3s"
                  }}>
                    <span style={{
                      color: progress > (i + 1) * 33 ? "var(--st-fill-ink)" : "var(--ink-3)"
                    }}>
                      {progress > (i + 1) * 33 ? "✓" : "○"}
                    </span>
                    {lang === "zh" ? s.z : s.e}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function ScreenMulti({ lang, setLang, goNext }) {
  const [checked, setChecked] = uS1(window.PRODUCTS.map(() => true));
  const [mode, setMode] = uS1("separate");

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader lang={lang} setLang={setLang} />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 600, width: "100%", background: "white", border: "1px solid var(--line)", borderRadius: 16, padding: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 600, color: "var(--st-ai-ink)",
            background: "var(--st-ai-bg)", padding: "4px 10px", borderRadius: 999, marginBottom: 14
          }}>
            <span>✦</span> {lang === "zh" ? "AI 已分析完成" : "AI analysis complete"}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--navy-ink)", margin: "0 0 22px", letterSpacing: "-0.01em" }}>
            {window.t("s3_title", lang)}
          </h2>

          <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
            {window.PRODUCTS.map((p, i) => (
              <label key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                border: "1px solid var(--line)", borderRadius: 10,
                background: checked[i] ? "rgba(46,90,138,0.04)" : "white",
                cursor: "pointer", transition: "background 0.15s"
              }}>
                <input
                  type="checkbox" checked={checked[i]}
                  onChange={(e) => {
                    const next = [...checked]; next[i] = e.target.checked; setChecked(next);
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--navy-ink)" }}>
                    {p.name}
                    <span style={{ fontWeight: 400, color: "var(--ink-2)", marginLeft: 8, fontSize: 13 }}>
                      — {p.subtitle[lang]}
                    </span>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)"
                }}>
                  {Math.round(75 + Math.random() * 20)}% {lang === "zh" ? "置信度" : "conf."}
                </span>
              </label>
            ))}
          </div>

          <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12, fontWeight: 500 }}>
            {lang === "zh" ? "如何处理:" : "How would you like to handle them:"}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              ["separate", "s3_setup_all", "s3_recommend"],
              ["combine", "s3_combine", null],
              ["focus_one", "s3_focus_one", null],
            ].map(([val, key, recKey]) => (
              <label key={val} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                border: `1px solid ${mode === val ? "var(--navy-2)" : "var(--line)"}`, borderRadius: 10,
                background: mode === val ? "rgba(46,90,138,0.04)" : "white",
                cursor: "pointer"
              }}>
                <input type="radio" checked={mode === val} onChange={() => setMode(val)} />
                <span style={{ flex: 1 }}>
                  <span style={{ color: "var(--ink)" }}>{window.t(key, lang)}</span>
                  {recKey && <span style={{ color: "var(--ink-3)", marginLeft: 6, fontSize: 12 }}>{window.t(recKey, lang)}</span>}
                </span>
              </label>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={goNext}
            style={{ width: "100%", marginTop: 28, padding: "12px 18px" }}
          >
            {window.t("s3_continue", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenRegister, ScreenOnboard, ScreenMulti });
