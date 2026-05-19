// Screens 5a (confirm modal), 5b (thanks), 6 (queue), 8 (publish).

const { useState: uS5, useEffect: uE5 } = React;

// ───────── Screen 5a — confirm modal (full-screen takeover) ─────────
function ScreenConfirm({ lang, setLang, goNext, goBack }) {
  return (
    <div className="screen-anim" style={{
      minHeight: "100vh", background: "rgba(15,36,64,0.45)", padding: 24,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(2px)"
    }}>
      <div style={{
        maxWidth: 1080, width: "100%", maxHeight: "92vh", overflow: "auto",
        background: "white", borderRadius: 16, boxShadow: "0 30px 80px rgba(15,36,64,0.3)"
      }}>
        <div style={{
          padding: "20px 28px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--navy-ink)", margin: 0 }}>
              {window.t("s5_title", lang)}
            </h2>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
              TMX — {window.PRODUCTS.find(p => p.id === "TMX").subtitle[lang]}
            </div>
          </div>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {/* Left: what you told us */}
          <div style={{ padding: "24px 28px", borderRight: "1px solid var(--line)" }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--ink-3)", marginBottom: 14
            }}>
              {window.t("s5_left", lang)}
            </div>
            {[2,3,4,5,6,7,8].map(secNum => {
              const meta = SECTION_META.find(m => m.num === secNum);
              const fields = Object.entries(window.FIELDS).filter(([,f]) => f.section === secNum);
              return (
                <div key={secNum} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 6 }}>
                    {meta.icon} {window.t(meta.key, lang)}
                  </div>
                  <ul style={{ margin: 0, padding: "0 0 0 16px", display: "grid", gap: 4 }}>
                    {fields.slice(0, 3).map(([id, f]) => (
                      <li key={id} style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                        <span style={{ color: "var(--ink-3)" }}>{f.label[lang]}: </span>
                        {valueOfConfirm(f.value, lang) || <em style={{ color: "var(--ink-3)" }}>{lang === "zh" ? "暂无" : "no data"}</em>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Right: what we generated */}
          <div style={{ padding: "24px 28px", background: "linear-gradient(180deg, rgba(107,63,160,0.04), transparent)" }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--cop-border)", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: 4, background: "var(--cop-border)",
                color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 10
              }}>✦</span>
              {window.t("s5_right", lang)}
            </div>

            <GenBlock title={window.t("s5_pain", lang)} accent="purple">
              <em style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6 }}>
                {window.AI_GENERATED.pain_narrative[lang]}
              </em>
            </GenBlock>

            <GenBlock title={window.t("s5_value", lang)} accent="purple">
              <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.6 }}>
                {window.AI_GENERATED.value_position[lang]}
              </div>
            </GenBlock>

            <GenBlock title={window.t("s5_caps", lang)} accent="purple">
              <ul style={{ margin: 0, padding: "0 0 0 16px", display: "grid", gap: 4, fontSize: 13 }}>
                {window.AI_GENERATED.capabilities_summary[lang].map((c, i) => (
                  <li key={i} style={{ color: "var(--ink)" }}>{c}</li>
                ))}
              </ul>
            </GenBlock>

            <GenBlock title={window.t("s5_pitch", lang)} accent="gold">
              <div style={{
                fontSize: 14, fontWeight: 600, color: "var(--navy-ink)",
                lineHeight: 1.5
              }}>
                "{window.AI_GENERATED.one_liner[lang]}"
              </div>
            </GenBlock>
          </div>
        </div>

        <div style={{
          padding: "18px 28px", borderTop: "1px solid var(--line)",
          display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center"
        }}>
          <button className="btn btn-ghost" onClick={goBack}>
            ← {window.t("s5_edit", lang)}
          </button>
          <button className="btn btn-primary" onClick={goNext} style={{ padding: "12px 24px" }}>
            {window.t("s5_confirm", lang)} →
          </button>
        </div>
      </div>
    </div>
  );
}

function GenBlock({ title, children, accent }) {
  const accentColor = accent === "gold" ? "var(--gold)" : "var(--cop-border)";
  return (
    <div style={{
      background: "white", border: "1px solid var(--line)",
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 8, padding: "12px 14px", marginBottom: 12
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--ink-3)",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6
      }}>{title}</div>
      {children}
    </div>
  );
}

function valueOfConfirm(v, lang) {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v[lang] || v.en || "";
  return String(v);
}

// ───────── Screen 5b — thank-you ─────────
function ScreenThanks({ lang, setLang, goNext }) {
  return (
    <div className="screen-anim platform-supplier" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column"
    }}>
      <AppHeader lang={lang} setLang={setLang} />

      <div style={{ flex: 1, padding: "60px 24px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--st-fill-bg)", color: "var(--st-fill-ink)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, marginBottom: 16
          }}>✓</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--navy-ink)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            {window.t("s5_thanks", lang)}
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 32px" }}>
            {window.t("s5_thanks_sub", lang)}
          </p>

          <div style={{
            background: "white", border: "1px solid var(--line)", borderRadius: 14, padding: 20,
            marginBottom: 16
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: "var(--navy-ink)", marginBottom: 12
            }}>{window.t("s5_progress_title", lang)}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {window.PRODUCTS.map(p => {
                const isTMX = p.id === "TMX";
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 12px", borderRadius: 8,
                    background: isTMX ? "var(--st-fill-bg)" : "var(--bg)"
                  }}>
                    <span style={{
                      width: 16, color: isTMX ? "var(--st-fill-ink)" : "var(--ink-3)",
                      fontWeight: 700
                    }}>
                      {isTMX ? "✓" : "○"}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--navy-ink)", minWidth: 50 }}>{p.name}</span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1 }}>
                      {p.subtitle[lang]}
                    </span>
                    <span style={{
                      fontSize: 12, color: isTMX ? "var(--st-fill-ink)" : "var(--ink-3)",
                      fontWeight: isTMX ? 600 : 400
                    }}>
                      {isTMX ? window.t("s5_progress_submitted", lang) : `0%`}
                    </span>
                    {!isTMX && (
                      <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12, color: "var(--navy-2)", fontWeight: 500 }}>
                        {window.t("s5_continue", lang)} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary">{window.t("s5_later", lang)}</button>
            <button className="btn btn-primary" onClick={goNext}>
              {lang === "zh" ? "继续录入下一个产品 →" : "Continue with next product →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Screen 6 — Curator queue ─────────
function ScreenQueue({ lang, setLang, goNext }) {
  const [filter, setFilter] = uS5("all");
  const rows = filter === "all" ? window.QUEUE : window.QUEUE.filter(r => r.status === filter);

  const statusBadge = (s) => {
    const map = {
      new: { cls: "ai", key: "s6_status_new" },
      review: { cls: "weak", key: "s6_status_review" },
      revision: { cls: "empty", key: "s6_status_revision" },
      approved: { cls: "filled", key: "s6_status_approved" },
    };
    const m = map[s];
    return <span className={`status-badge ${m.cls}`}>{window.t(m.key, lang)}</span>;
  };

  const matIcon = (m) => {
    const M = { pdf: "PDF", ppt: "PPT", url: "URL", voice: "VOX" };
    const colors = { pdf: "#DC2626", ppt: "#EA580C", url: "#2563EB", voice: "#7C3AED" };
    return (
      <span key={m} style={{
        fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
        color: colors[m], padding: "2px 5px",
        background: "white", border: `1px solid ${colors[m]}40`, borderRadius: 3
      }}>{M[m]}</span>
    );
  };

  return (
    <div className="screen-anim platform-curator" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CuratorHeader lang={lang} setLang={setLang} activeTab="subs" />

      <div style={{ padding: "20px 24px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--navy-ink)", margin: 0 }}>
            {window.t("s6_title", lang)}
            <span style={{ fontWeight: 400, color: "var(--ink-3)", marginLeft: 10, fontSize: 14 }}>
              {rows.length} {lang === "zh" ? "条" : "items"}
            </span>
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="text-input" placeholder={window.t("s6_search", lang)} style={{ width: 240, fontSize: 13, padding: "7px 10px" }} />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-input"
              style={{ width: "auto", padding: "7px 10px", fontSize: 13 }}
            >
              <option value="all">{lang === "zh" ? "全部状态" : "All status"}</option>
              <option value="new">{window.t("s6_status_new", lang)}</option>
              <option value="review">{window.t("s6_status_review", lang)}</option>
              <option value="revision">{window.t("s6_status_revision", lang)}</option>
              <option value="approved">{window.t("s6_status_approved", lang)}</option>
            </select>
          </div>
        </div>

        <div style={{
          background: "white", borderRadius: 10, border: "1px solid var(--line)",
          overflow: "hidden"
        }}>
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "100px 1.6fr 1.4fr 100px 90px 110px 100px",
            gap: 12, padding: "10px 16px",
            fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
            color: "var(--ink-3)", borderBottom: "1px solid var(--line)", background: "#FAFAF7"
          }}>
            <div>{window.t("s6_col_status", lang)}</div>
            <div>{window.t("s6_col_supplier", lang)}</div>
            <div>{window.t("s6_col_product", lang)}</div>
            <div>{window.t("s6_col_submitted", lang)}</div>
            <div>{window.t("s6_col_prefill", lang)}</div>
            <div>{window.t("s6_col_materials", lang)}</div>
            <div></div>
          </div>
          {rows.map((r, i) => (
            <div key={r.id} style={{
              display: "grid",
              gridTemplateColumns: "100px 1.6fr 1.4fr 100px 90px 110px 100px",
              gap: 12, padding: "12px 16px",
              fontSize: 13, alignItems: "center",
              borderBottom: i < rows.length - 1 ? "1px solid var(--line-2)" : "none",
              transition: "background 0.12s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.015)"}
            onMouseLeave={(e) => e.currentTarget.style.background = ""}
            >
              <div>{statusBadge(r.status)}</div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--navy-ink)" }}>{r.supplier}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{r.contact}</div>
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>{r.product}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.productSub[lang]}</div>
              </div>
              <div style={{ color: "var(--ink-2)", fontSize: 12 }}>{r.submitted[lang]}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="conf-bar" style={{ width: 32 }}>
                    <div className="conf-bar-fill" style={{ width: `${r.prefill}%`, background: r.prefill > 70 ? "var(--st-fill-ink)" : r.prefill > 50 ? "var(--st-weak-ink)" : "var(--st-empty-ink)" }} />
                  </div>
                  <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--ink-2)", fontWeight: 500 }}>
                    {r.prefill}%
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {r.materials.map(matIcon)}
              </div>
              <div>
                <button
                  className="btn-ghost"
                  onClick={r.id === "S-2418" ? goNext : null}
                  style={{
                    padding: "5px 10px", fontSize: 12, fontWeight: 600,
                    color: "var(--navy-2)", borderRadius: 6,
                    border: "1px solid var(--line)"
                  }}
                >
                  {window.t("s6_review", lang)}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 16 }}>
          <span><span className="kbd">↑↓</span> {lang === "zh" ? "选择" : "navigate"}</span>
          <span><span className="kbd">↵</span> {lang === "zh" ? "打开" : "open"}</span>
          <span><span className="kbd">/</span> {lang === "zh" ? "搜索" : "search"}</span>
          <span><span className="kbd">f</span> {lang === "zh" ? "筛选" : "filter"}</span>
        </div>
      </div>
    </div>
  );
}

// ───────── Screen 8 — Publish confirmation ─────────
function ScreenPublish({ lang, setLang, goBack, onPublish }) {
  const [published, setPublished] = uS5(false);
  const [showPreview, setShowPreview] = uS5(false);

  if (published) {
    return (
      <div className="screen-anim platform-curator" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CuratorHeader lang={lang} setLang={setLang} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--st-fill-bg)", color: "var(--st-fill-ink)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, marginBottom: 18
            }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy-ink)", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
              {window.t("s8_published", lang)}
            </h2>
            <p style={{ color: "var(--ink-2)", margin: "0 0 24px" }}>
              {window.t("s8_notified", lang)}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={goBack}>{window.t("s8_back_queue", lang)}</button>
              <button
                className="btn btn-primary tooltip"
                data-tip={window.t("s8_listing_tooltip", lang)}
                onClick={onPublish}
              >
                {window.t("s8_view_listing", lang)}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-anim" style={{ minHeight: "100vh", background: "rgba(15,36,64,0.45)", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <CuratorHeader lang={lang} setLang={setLang} />
      </div>
      <div style={{
        maxWidth: 580, width: "100%",
        background: "white", borderRadius: 16, padding: 32,
        boxShadow: "0 30px 80px rgba(15,36,64,0.3)"
      }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--navy-ink)", margin: "0 0 18px", letterSpacing: "-0.01em" }}>
          {window.t("s8_title", lang)}
        </h2>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            {window.t("s8_will", lang)}
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.7 }}>
            <li>{window.t("s8_will1", lang)}</li>
            <li>{window.t("s8_will2", lang)}</li>
            <li>{window.t("s8_will3", lang)}</li>
          </ul>
        </div>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className="btn btn-secondary"
          style={{ width: "100%", justifyContent: "space-between" }}
        >
          <span>{window.t("s8_preview_notif", lang)}</span>
          <span style={{ transform: showPreview ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.18s" }}>›</span>
        </button>

        {showPreview && (
          <div style={{
            marginTop: 12, padding: 14,
            background: "var(--bg)", border: "1px solid var(--line)",
            borderRadius: 8, fontSize: 13, color: "var(--ink)", lineHeight: 1.6
          }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>
              {lang === "zh" ? "邮件预览" : "Email preview"}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {lang === "zh" ? "Vigil 你好,TMX 已通过审核 🎉" : "Vigil, TMX has been approved 🎉"}
            </div>
            <div>
              {lang === "zh"
                ? "你的产品 TMX 已通过 RoleMaster 审核,作为「AML 监控分析师助手」上线销售目录。我们会尽快联系你确认下一步合作细节。"
                : "Your product TMX has been approved as the \"AML Monitoring Analyst Assistant\" RolePack and is now in the sales catalog. We'll reach out shortly to align on next steps."}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={goBack}>{window.t("s8_cancel", lang)}</button>
          <button className="btn btn-gold" onClick={() => setPublished(true)} style={{ padding: "12px 24px" }}>
            {window.t("s8_confirm_pub", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenConfirm, ScreenThanks, ScreenQueue, ScreenPublish });
