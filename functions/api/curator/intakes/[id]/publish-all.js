// POST /api/curator/intakes/:id/publish-all — publish every ready rolepack
// in one go. By design we do NOT notify or email the partner.

import { json } from '../../../_helpers.js';
import { callClaude } from '../../../_lib/ai/client.js';
import { parseStrictJson } from '../../../_lib/ai/parse.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const id = context.params.id;
  const { env } = context;

  let body = {};
  try { body = await context.request.json(); } catch {}
  // Optional rename map from the publish UI: rename RP/RC labels right before
  // they hit the sales library so curators can swap RP-01 → RP-AML, etc.
  const rpRenames = Array.isArray(body.rp_renames) ? body.rp_renames : [];
  const capRenames = Array.isArray(body.cap_renames) ? body.cap_renames : [];

  const intake = await env.DB.prepare(
    'SELECT id, supplier_id, name FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);

  // Auto-suggest semantic labels for any RP/RC still using the placeholder
  // RP-NN / RC-NN form. Curators can also rename via the UI (rp_renames /
  // cap_renames body params) — those wins over the AI suggestions.
  if (env.QWEN_API_KEY || env.DASHSCOPE_API_KEY) {
    const { results: rpsAll } = await env.DB.prepare(
      'SELECT id, rp_label, name_zh, name_en FROM rolepacks_v2 WHERE intake_id = ?'
    ).bind(id).all();
    const { results: capsAll } = await env.DB.prepare(
      'SELECT id, rc_label, name_zh, name_en, description_zh, description_en FROM capabilities WHERE intake_id = ?'
    ).bind(id).all();
    const renamedRpIds = new Set(rpRenames.map(r => r.id));
    const renamedCapIds = new Set(capRenames.map(c => c.id));
    const rpNeedsLabel = (rpsAll || []).filter(r => /^RP-\d+$/.test(r.rp_label || '') && !renamedRpIds.has(r.id));
    const capNeedsLabel = (capsAll || []).filter(c => /^RC-\d+$/.test(c.rc_label || '') && !renamedCapIds.has(c.id));
    if (rpNeedsLabel.length || capNeedsLabel.length) {
      const ai = await suggestLabels(env, id, intake.name, rpNeedsLabel, capNeedsLabel);
      // Apply suggestions, dedupe defensively against curator-applied renames.
      const usedRp = new Set([...rpRenames.map(r => String(r.label).toUpperCase().trim()),
        ...(rpsAll || []).filter(r => !/^RP-\d+$/.test(r.rp_label || '')).map(r => r.rp_label.toUpperCase())]);
      for (const s of (ai.rp || [])) {
        const lbl = uniqueLabel(s.suggested_label, usedRp, 'RP');
        if (!lbl) continue;
        await env.DB.prepare(
          `UPDATE rolepacks_v2 SET rp_label = ?, updated_at = datetime('now') WHERE id = ? AND intake_id = ?`
        ).bind(lbl, s.id, id).run();
        usedRp.add(lbl);
      }
      const usedCap = new Set([...capRenames.map(c => String(c.label).toUpperCase().trim()),
        ...(capsAll || []).filter(c => !/^RC-\d+$/.test(c.rc_label || '')).map(c => c.rc_label.toUpperCase())]);
      for (const s of (ai.cap || [])) {
        const lbl = uniqueLabel(s.suggested_label, usedCap, 'RC');
        if (!lbl) continue;
        await env.DB.prepare(
          `UPDATE capabilities SET rc_label = ? WHERE id = ? AND intake_id = ?`
        ).bind(lbl, s.id, id).run();
        usedCap.add(lbl);
      }
    }
  }

  // Apply renames first. Validate uniqueness across this intake before writing.
  if (rpRenames.length > 0) {
    const seen = new Set();
    for (const r of rpRenames) {
      if (!r?.id || !r?.label) continue;
      const lbl = String(r.label).trim().toUpperCase();
      if (!lbl || seen.has(lbl)) return json({ error: 'duplicate_rp_label', label: lbl }, 400);
      seen.add(lbl);
    }
    for (const r of rpRenames) {
      await env.DB.prepare(
        `UPDATE rolepacks_v2 SET rp_label = ?, updated_at = datetime('now')
         WHERE id = ? AND intake_id = ?`
      ).bind(String(r.label).trim().toUpperCase(), r.id, id).run();
    }
  }
  if (capRenames.length > 0) {
    const seen = new Set();
    for (const c of capRenames) {
      if (!c?.id || !c?.label) continue;
      const lbl = String(c.label).trim().toUpperCase();
      if (!lbl || seen.has(lbl)) return json({ error: 'duplicate_cap_label', label: lbl }, 400);
      seen.add(lbl);
    }
    for (const c of capRenames) {
      await env.DB.prepare(
        `UPDATE capabilities SET rc_label = ? WHERE id = ? AND intake_id = ?`
      ).bind(String(c.label).trim().toUpperCase(), c.id, id).run();
    }
  }

  const { results: rolepacks } = await env.DB.prepare(`
    SELECT id, status, generated_json, rp_label, name_zh, name_en
    FROM rolepacks_v2
    WHERE intake_id = ?
    ORDER BY position
  `).bind(id).all();

  // ─── Duplicate-label guard ──────────────────────────────────────────
  // No two ALREADY-PUBLISHED rolepacks should share an rp_label across
  // intakes — buyers in /rolepacks see "RP-AML 销售代表" and "RP-AML
  // 反洗钱专员" side by side and can't tell which is which. Same for
  // rc_label across capabilities linked to published rolepacks. Check
  // here AFTER renames are applied so curator-typed names are validated
  // too. If a conflict is found, return 409-style payload so the UI can
  // prompt for a rename.
  const { results: thisCaps } = await env.DB.prepare(
    'SELECT id, rc_label FROM capabilities WHERE intake_id = ?'
  ).bind(id).all();
  const myRpLabels = (rolepacks || [])
    .map(r => ({ id: r.id, label: r.rp_label }))
    .filter(r => r.label);
  const myCapLabels = (thisCaps || [])
    .map(c => ({ id: c.id, label: c.rc_label }))
    .filter(c => c.label);

  const rpConflicts = [];
  for (const r of myRpLabels) {
    const hit = await env.DB.prepare(`
      SELECT rp.id, rp.rp_label, rp.intake_id, i.name AS intake_name,
             COALESCE(NULLIF(sci.company_name_zh, ''), NULLIF(sci.company_name_en, ''), s.name, s.short_name) AS supplier_name
      FROM rolepacks_v2 rp
      JOIN intakes i ON i.id = rp.intake_id
      JOIN suppliers s ON s.id = i.supplier_id
      LEFT JOIN supplier_company_info sci ON sci.supplier_id = s.id
      WHERE rp.status = 'published'
        AND rp.intake_id != ?
        AND rp.rp_label = ?
      LIMIT 1
    `).bind(id, r.label).first();
    if (hit) {
      rpConflicts.push({
        id: r.id, label: r.label,
        conflictWith: {
          rolepack_id: hit.id, intake_id: hit.intake_id,
          supplier: hit.supplier_name, product: hit.intake_name,
        },
      });
    }
  }

  const capConflicts = [];
  for (const c of myCapLabels) {
    const hit = await env.DB.prepare(`
      SELECT cap.id, cap.rc_label, cap.intake_id, i.name AS intake_name,
             COALESCE(NULLIF(sci.company_name_zh, ''), NULLIF(sci.company_name_en, ''), s.name, s.short_name) AS supplier_name
      FROM capabilities cap
      JOIN rolepack_capabilities rcp ON rcp.capability_id = cap.id
      JOIN rolepacks_v2 rp ON rp.id = rcp.rolepack_id
      JOIN intakes i ON i.id = cap.intake_id
      JOIN suppliers s ON s.id = i.supplier_id
      LEFT JOIN supplier_company_info sci ON sci.supplier_id = s.id
      WHERE rp.status = 'published'
        AND cap.intake_id != ?
        AND cap.rc_label = ?
      LIMIT 1
    `).bind(id, c.label).first();
    if (hit) {
      capConflicts.push({
        id: c.id, label: c.label,
        conflictWith: {
          intake_id: hit.intake_id,
          supplier: hit.supplier_name, product: hit.intake_name,
        },
      });
    }
  }

  if (rpConflicts.length || capConflicts.length) {
    return json({
      ok: false,
      reason: 'label_conflict',
      message_zh: '部分 RP/RC 代码已被其它已发布岗位使用,请重命名后再发布。',
      message_en: 'Some RP/RC labels are already used by other published items. Rename them and try again.',
      conflicts: { rp: rpConflicts, cap: capConflicts },
    });
  }

  // Safety net BEFORE the ready filter: any rolepack of this intake that has
  // ZERO linked capabilities gets ALL of the intake's capabilities linked to
  // it. Runs over ALL rolepacks (including already-published), so re-clicking
  // publish on an intake whose old run shipped with empty caps backfills
  // them now. Caught in production: Aselo's RP-SALES / RP-ADMIN went live
  // with no RC pills because the supplier never toggled chips on the roles
  // screen.
  const { results: capRows } = await env.DB.prepare(
    'SELECT id FROM capabilities WHERE intake_id = ? ORDER BY position'
  ).bind(id).all();
  const allCapIds = (capRows || []).map(c => c.id);
  if (allCapIds.length > 0) {
    for (const r of (rolepacks || [])) {
      const { results: existingLinks } = await env.DB.prepare(
        'SELECT 1 FROM rolepack_capabilities WHERE rolepack_id = ? LIMIT 1'
      ).bind(r.id).all();
      if (!existingLinks || existingLinks.length === 0) {
        for (let j = 0; j < allCapIds.length; j++) {
          await env.DB.prepare(
            'INSERT OR IGNORE INTO rolepack_capabilities (rolepack_id, capability_id, position) VALUES (?, ?, ?)'
          ).bind(r.id, allCapIds[j], j).run();
        }
      }
    }
  }

  const ready = (rolepacks || []).filter(r => r.generated_json && r.status !== 'published');
  const skipped = (rolepacks || []).filter(r => !r.generated_json || r.status === 'published')
    .map(r => ({
      id: r.id, rp_label: r.rp_label,
      reason: r.status === 'published' ? 'already_published' : 'not_generated',
    }));

  if (ready.length === 0) {
    // Even when nothing fresh to publish, the safety-net cap-link backfill
    // above may have run — return success so the curator UI can refresh and
    // the public catalogue picks up the newly-linked caps.
    return json({ ok: true, published: [], skipped, backfilled_caps: allCapIds.length > 0 });
  }

  // Flip all ready rolepacks to published in one batch.
  const stmts = ready.map(r => env.DB.prepare(
    `UPDATE rolepacks_v2 SET status = 'published', updated_at = datetime('now') WHERE id = ?`
  ).bind(r.id));
  await env.DB.batch(stmts);

  // Move the intake itself out of the review queue. Without this, the
  // curator inbox keeps the intake in "审阅中" forever even after every
  // rolepack ships. Mark as fully published only when ALL rolepacks are
  // published; otherwise leave intake status alone (some packs still ready).
  const { results: postState } = await env.DB.prepare(
    'SELECT status FROM rolepacks_v2 WHERE intake_id = ?'
  ).bind(id).all();
  const allPublished = (postState || []).length > 0
    && (postState || []).every(r => r.status === 'published');
  if (allPublished) {
    // Lazy-add the is_published column (idempotent) and flip it. We can't
    // use intakes.status='published' because the column's CHECK constraint
    // doesn't include that value, and SQLite can't ALTER CHECK constraints
    // in place. is_published is an orthogonal boolean flag that the
    // curator inbox + frontend phaseOf both consult.
    try { await env.DB.prepare(`ALTER TABLE intakes ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
    await env.DB.prepare(
      `UPDATE intakes SET is_published = 1, updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
  }

  // No supplier notification or email — by design (curator publish flow does
  // not send out anything to the partner).

  return json({
    ok: true,
    published: ready.map(r => ({ id: r.id, rp_label: r.rp_label, name_zh: r.name_zh, name_en: r.name_en })),
    skipped,
  });
}

// Generate semantic labels (RP-AML, RC-KYC etc) for any rolepacks/capabilities
// still using the placeholder RP-NN / RC-NN form. One AI call covers both
// kinds. Failure leaves the originals untouched — publish still proceeds.
async function suggestLabels(env, intakeId, productName, rps, caps) {
  if (!rps.length && !caps.length) return { rp: [], cap: [] };
  const sys = `You name internal codebook labels for an enterprise software catalogue. Given a list of roles and capabilities (each with a current placeholder label like RP-01 or RC-01), suggest a SHORT semantic label where the suffix describes the role/capability function.

Rules:
- Suffix is 2–5 uppercase letters/digits, derived from the FUNCTION (the work performed), never from the supplier brand or product name.
- Examples — Good: RP-AML, RP-RM, RP-KYC, RC-DD, RC-COACH, RC-TRX, RC-ALERT, RC-RENDR.
- Examples — Forbidden: RP-AURORA (brand), RP-VIGIL (brand), RC-WIZBANK (product) — never derive from supplier brand or product name.
- Each label must be unique within its kind across this intake.

Output strict JSON only:
{ "rp": [{ "id": "<id>", "suggested_label": "RP-XXX" }, ...], "cap": [{ "id": "<id>", "suggested_label": "RC-XXX" }, ...] }`;
  const userPrompt = [
    `Product: ${productName || '(unknown)'}`,
    rps.length ? '\nRoles to label:' : '',
    ...rps.map(r => `- id:${r.id} | current:${r.rp_label} | name_zh:${r.name_zh || ''} | name_en:${r.name_en || ''}`),
    caps.length ? '\nCapabilities to label:' : '',
    ...caps.map(c => `- id:${c.id} | current:${c.rc_label} | name_zh:${c.name_zh || ''} | name_en:${c.name_en || ''} | desc:${(c.description_zh || c.description_en || '').slice(0, 160)}`),
    '',
    'Return strict JSON.',
  ].filter(Boolean).join('\n');
  try {
    const r = await callClaude(env, {
      surface: 'publish-suggest-labels',
      submissionId: intakeId,
      system: sys,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1500,
      timeoutMs: 30_000,
    });
    if (!r.ok) return { rp: [], cap: [] };
    const parsed = parseStrictJson(r.text) || {};
    return { rp: parsed.rp || [], cap: parsed.cap || [] };
  } catch { return { rp: [], cap: [] }; }
}

// Defensive: enforce shape (RP-XXX / RC-XXX with 2-5 uppercase suffix), make
// it unique within the intake by appending a digit if the AI produced a dupe.
function uniqueLabel(suggested, used, kind) {
  const m = String(suggested || '').toUpperCase().trim().match(/^(RP|RC)-([A-Z0-9]{1,5})$/);
  if (!m) return null;
  if (m[1] !== kind) return null;
  let lbl = `${kind}-${m[2]}`;
  if (!used.has(lbl)) return lbl;
  for (let i = 2; i < 10; i++) {
    const candidate = `${kind}-${m[2]}${i}`.slice(0, kind.length + 1 + 5);
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

