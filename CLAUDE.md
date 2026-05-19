# RoleMaster — 开发规范

## 项目概况

AI 能力交付平台。三个角色门户：
- **Supplier（供应商）** — AI 咨询公司打包 AI 产品
- **Curator（审核员）** — RoleMaster 内部审核并发布 RolePack
- **Sales（销售）** — 销售人员浏览已发布的 RolePack 目录

## Git 工作流

### 分支规则

| 分支 | 用途 | 说明 |
|---|---|---|
| `main` | 生产分支 | 只接受来自 `develop` 的 PR，不直接提交 |
| `develop` | 集成分支 | 日常开发的目标分支，所有功能分支合并到这里 |
| `feature/xxx` | 功能分支 | 从 `develop` 创建，完成后 PR 回 `develop` |
| `fix/xxx` | 修复分支 | 从 `develop` 创建（紧急 bug 从 `main` 创建） |

### 日常开发流程

```bash
# 开始新功能
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# 开发、提交
git add <files>
git commit -m "feat: 描述这个功能做了什么"

# 完成后推送，在 GitHub 创建 PR → develop
git push origin feature/your-feature-name
```

### Commit 信息格式

```
feat: 新增功能
fix: 修复 bug
refactor: 重构（不改变行为）
style: 样式调整
docs: 文档更新
chore: 构建/配置变更
```

## 技术栈

### 现状（Cloudflare 架构）
- **前端** — React 18 + Vite，`app/` 目录
- **后端** — Cloudflare Pages Functions，`functions/` 目录
- **数据库** — Cloudflare D1（SQLite），schema 见 `schema.sql`
- **文件存储** — Cloudflare R2
- **AI** — DashScope（阿里云）Qwen 模型

### 迁移目标（进行中）
- **后端** → 独立 Node.js 服务（`backend/` 目录，待建）
- **数据库** → PostgreSQL（Supabase 或 Neon）
- **前端** → 不变，更新 API 地址指向新后端

## 本地开发

### 前端（仅 UI，使用 mock 数据）

```bash
cd app
npm install
npm run dev
# → http://localhost:5173
```

### 完整本地环境（需要 Cloudflare 账号）

```bash
# 根目录安装依赖
npm install

# 创建本地环境变量
echo 'JWT_SECRET="local-dev-only"' > .dev.vars

# 初始化本地数据库
npx wrangler d1 execute rolemaster-db --local --file=schema.sql
npx wrangler d1 execute rolemaster-db --local --file=seed.sql

# 构建前端（wrangler 需要 dist/）
cd app && npm run build && cd ..

# 同时启动前端 + 后端
npm run dev
```

## 环境变量

| 变量 | 说明 | 必填 |
|---|---|---|
| `JWT_SECRET` | JWT 签名密钥，随机字符串 | 是 |
| `QWEN_API_KEY` | DashScope API Key | AI 功能需要 |
| `QWEN_MODEL` | 模型名称，默认 `qwen-plus` | 否 |
| `QWEN_BASE_URL` | API 地址，默认国际版 | 否 |

本地开发放在 `.dev.vars`（已在 `.gitignore` 中，不提交）。

## 目录结构

```
rolemaster/
├── app/               前端（React + Vite）
├── functions/         后端（Cloudflare Pages Functions，待迁移）
├── backend/           新后端（Node.js，待建立）
├── scripts/           工具脚本
├── docs/              产品文档
├── schema.sql         数据库 schema（D1/SQLite 版本）
├── seed.sql           测试数据
├── wrangler.toml      Cloudflare 配置
└── CLAUDE.md          本文件
```

## 禁止事项

- 不直接向 `main` 提交代码
- 不提交 `.dev.vars`、`.wrangler/`、`dist/`、`node_modules/`
- 不在未经测试的情况下部署到生产
- 不运行 `wrangler d1 execute --remote` 修改生产数据库（需要明确确认）
