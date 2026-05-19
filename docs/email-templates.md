# RoleMaster Email Templates — Capability Partners

Copy-paste templates for transactional emails sent to Capability Partners (the JWT role is still `supplier` internally; user-facing label is "能力伙伴 / Capability Partner").

All templates are bilingual zh / en. Use the language of the partner's `users.preferred_lang`, defaulting to `zh` for `.cn` / `.hk` domains and `en` otherwise.

Variables in `{{double_braces}}` should be replaced at send time. The system has no email-sending integration yet — these are drafts for whatever provider gets wired up (SendGrid, Postmark, Mailgun, Cloudflare Email Routing, etc.).

---

## 1. Welcome — sent immediately after register

**Trigger:** `POST /api/auth/register` returns 200
**To:** new user
**Subject (zh):** 欢迎加入 RoleMaster 能力伙伴
**Subject (en):** Welcome to RoleMaster Capability Partners

### zh

```
{{contact_name}},您好,

欢迎成为 RoleMaster 能力伙伴。
您的账户已创建:{{contact_email}}。

下一步:
1. 前往 https://www.airolemaster.com/partners/onboard 上传第一份产品资料
2. AI Copilot 会在 30 秒内自动梳理出能力清单和岗位匹配
3. 您审核确认后,我们的策展团队会在 1-3 个工作日内发布到方案目录,供方案顾问推荐给企业客户

如需帮助,直接回复本邮件或写信至 hello@rolemaster.io。

—— RoleMaster 团队
https://www.airolemaster.com
```

### en

```
Hi {{contact_name}},

Welcome to RoleMaster Capability Partners.
Your account is ready: {{contact_email}}.

Next steps:
1. Visit https://www.airolemaster.com/partners/onboard and upload your first product brief
2. The AI Copilot will draft your capabilities and role matches in ~30 seconds
3. Once you confirm, our curation team publishes within 1-3 business days. Solution Advisors will then recommend you to enterprise clients.

Reply to this email or write to hello@rolemaster.io with any questions.

— The RoleMaster team
https://www.airolemaster.com
```

---

## 2. Submission received — sent after the partner clicks "Submit for review"

**Trigger:** `POST /api/intakes/:id/finalize` returns 200
**Subject (zh):** {{product_name}} 已提交审阅
**Subject (en):** {{product_name}} submitted for review

### zh

```
{{contact_name}},

我们已收到您 {{product_name}} 的提交,共 {{rolepack_count}} 个岗位:
{{rolepack_list_zh}}

审阅团队会在 1-3 个工作日内联系您。提交编号:{{intake_id}}。

查看进度:https://www.airolemaster.com/partners

—— RoleMaster 团队
```

### en

```
Hi {{contact_name}},

We've received your {{product_name}} submission ({{rolepack_count}} role(s)):
{{rolepack_list_en}}

Our curation team will reach out within 1-3 business days. Submission ID: {{intake_id}}.

Track progress: https://www.airolemaster.com/partners

— The RoleMaster team
```

---

## 3. Approved + published — sent when curator publishes a rolepack

**Trigger:** `POST /api/curator/rolepacks/:rpId/publish` (or `publish-all` for batch)
**Subject (zh):** ✓ {{rolepack_name}} 已上架方案目录
**Subject (en):** ✓ {{rolepack_name}} is live in the catalog

### zh

```
好消息,{{contact_name}}

{{rolepack_name}}{{rp_label}}已通过审阅,正式上架方案目录。
方案顾问现在可以为企业客户推荐这个岗位。

查看上架版:https://www.airolemaster.com/advisors/rolepack/{{rolepack_id}}
管理:https://www.airolemaster.com/partners/intake/{{intake_id}}/role/{{rolepack_id}}/details

—— RoleMaster 策展团队
```

### en

```
Good news, {{contact_name}}.

{{rolepack_name}} ({{rp_label}}) has been approved and is now live in the catalog.
Solution Advisors can now recommend this role to enterprise clients.

Catalog page: https://www.airolemaster.com/advisors/rolepack/{{rolepack_id}}
Manage: https://www.airolemaster.com/partners/intake/{{intake_id}}/role/{{rolepack_id}}/details

— The RoleMaster curation team
```

---

## 4. Revision requested — curator sends submission back

**Trigger:** Curator marks intake as `needs_revision` (S6 kanban "needs revision" column)
**Subject (zh):** {{product_name}} 需要补充内容
**Subject (en):** {{product_name}} needs a small revision

### zh

```
{{contact_name}},

我们的策展团队看完了 {{product_name}},有几处希望您补充或调整:

{{revision_notes}}

修改完成后请重新点击「确认无误,提交审阅」。

返回编辑:https://www.airolemaster.com/partners/intake/{{intake_id}}/review

—— RoleMaster 策展团队
```

### en

```
Hi {{contact_name}},

Our curation team reviewed {{product_name}} and has a few items they'd like you to expand or adjust:

{{revision_notes}}

Once updated, click "Submit for review" again on the review screen.

Edit: https://www.airolemaster.com/partners/intake/{{intake_id}}/review

— The RoleMaster curation team
```

---

## 5. Held / paused — curator places submission in Meeting phase

**Trigger:** Curator drags intake to "Meeting" column (S6 kanban)
**Subject (zh):** 关于 {{product_name}} 的对接会议
**Subject (en):** Let's set up a call about {{product_name}}

### zh

```
{{contact_name}},

我们想在审阅 {{product_name}} 之前先和您聊一下,确认几个细节:

{{meeting_topics}}

请回复方便的 30 分钟时段(本周或下周),我们会发出会议链接。

—— RoleMaster 策展团队 / {{curator_name}}
```

### en

```
Hi {{contact_name}},

Before we finalize the review of {{product_name}}, we'd like a 30-minute call with you to clarify:

{{meeting_topics}}

Please reply with a few time slots that work this week or next, and we'll send a calendar invite.

— RoleMaster curation team / {{curator_name}}
```

---

## Implementation note

When you wire up an email provider, the trigger points are already instrumented in the backend:
- Register: `functions/api/auth/register.js` lines 50-54 (success path)
- Submit: `functions/api/intakes/[id]/finalize.js` line 35 (logEvent already fires)
- Publish: `functions/api/curator/rolepacks/[rpId]/publish.js`
- Revision / Hold: curator workbench dispatches via `/api/curator/intakes/:id/...` actions

A single helper `sendEmail({ to, subjectKey, lang, vars })` reading from `templates.js` (Markdown → HTML) would be enough.
