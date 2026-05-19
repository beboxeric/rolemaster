// POST /api/curator/rolepacks/:rpId/publish — curator marks a rolepack as published.
// Side-effects:
//   1. notification row in `notifications` for the supplier user
//   2. email via MailChannels (best-effort; failure does not fail the publish)

import { json, notify } from '../../../_helpers.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const rpId = context.params.rpId;

  const rp = await context.env.DB.prepare(`
    SELECT rp.id, rp.status, rp.generated_json, rp.rp_label, rp.name_zh, rp.name_en, rp.intake_id,
           i.supplier_id, i.name AS product_name,
           (SELECT id FROM users WHERE supplier_id = i.supplier_id LIMIT 1) AS supplier_user_id,
           (SELECT email FROM users WHERE supplier_id = i.supplier_id LIMIT 1) AS supplier_email
    FROM rolepacks_v2 rp
    JOIN intakes i ON i.id = rp.intake_id
    WHERE rp.id = ?
  `).bind(rpId).first();
  if (!rp) return json({ error: 'not_found' }, 404);
  if (!rp.generated_json) return json({ ok: false, reason: 'not_generated' }, 400);

  await context.env.DB.prepare(
    `UPDATE rolepacks_v2 SET status = 'published', updated_at = datetime('now') WHERE id = ?`
  ).bind(rpId).run();

  // 1. In-app notification
  await notify(context.env, rp.supplier_user_id, 'rolepack_published', {
    rolepack_id: rp.id,
    rp_label: rp.rp_label,
    role_name_zh: rp.name_zh,
    role_name_en: rp.name_en,
    intake_id: rp.intake_id,
    product_name: rp.product_name,
  });

  // 2. Email (best-effort via Cloudflare MailChannels)
  if (rp.supplier_email) {
    sendPublishedEmail(rp.supplier_email, rp).catch(() => {});
  }

  return json({ ok: true });
}

async function sendPublishedEmail(to, rp) {
  const productLabel = rp.product_name || rp.rp_label;
  const roleLabel = rp.name_zh || rp.name_en || rp.rp_label;
  const subject = `RoleMaster: 您的岗位「${roleLabel}」已发布上线 / Your role "${roleLabel}" is published`;
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1F2937;">
      <p>恭喜!您在 RoleMaster 提交的岗位 <strong>${escapeHtml(roleLabel)}</strong>(产品:<strong>${escapeHtml(productLabel)}</strong>)已通过审阅并发布到销售库。</p>
      <p>销售团队现在可以浏览并使用这份岗位包。如需修改任何内容,请联系策展人 <a href="mailto:hello@rolemaster.io">hello@rolemaster.io</a>。</p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0;" />
      <p>Congratulations — your role <strong>${escapeHtml(roleLabel)}</strong> (product: <strong>${escapeHtml(productLabel)}</strong>) has been published to the sales library.</p>
      <p>Sales reps can now browse and use this RolePack. To request edits, email <a href="mailto:hello@rolemaster.io">hello@rolemaster.io</a>.</p>
    </div>`;
  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'noreply@rolemaster.io', name: 'RoleMaster' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
