# Contributing to CampusHub

首先感谢你愿意参与贡献！无论你是提交 issue、修复 bug、补充文档，还是改进设计，都非常欢迎。

First of all, thank you for considering contributing to CampusHub! Whether you are filing an issue, fixing a bug, improving docs, or polishing design — you are very welcome.

---

## 目录 / Table of Contents

- [开发环境 / Development Setup](#开发环境--development-setup)
- [如何提交 Issue / How to File an Issue](#如何提交-issue--how-to-file-an-issue)
- [如何提交代码 / How to Submit Code](#如何提交代码--how-to-submit-code)
- [代码规范 / Code Style](#代码规范--code-style)
- [提交信息规范 / Commit Message Convention](#提交信息规范--commit-message-convention)
- [测试要求 / Testing Requirements](#测试要求--testing-requirements)
- [社区公约 / Code of Conduct](#社区公约--code-of-conduct)

---

## 开发环境 / Development Setup

**要求 / Requirements**：Node.js 20+、PostgreSQL 14+、pnpm 或 npm 12+

```bash
# 1. 克隆仓库 / Clone the repo
git clone https://github.com/X33834/campushub.git
cd campushub

# 2. 服务层 / Service layer (:3000)
cd apps/server
bash scripts/setup-db.sh          # create database & user
node scripts/seed.mjs             # seed data
bash scripts/make-demo.sh         # demo accounts & content
npm install && npm run build && node dist/main.js

# 3. 学生端 / Student H5 (:4173)
cd ../web
npm install
npm run dev

# 4.（可选）管理后台 / Admin console (:8848)
cd ../admin
cp .env.example .env              # VITE_ROUTER_HISTORY="hash" 必填
npm install && npm run dev
```

> 更多部署细节见 [docs/DEPLOY.md](docs/DEPLOY.md)。

---

## 如何提交 Issue / How to File an Issue

提交前请先搜索是否已有相同 issue（Search for existing issues first）。

**Bug 报告请包含 / For bug reports, please include：**

1. 复现步骤（Steps to reproduce）
2. 期望行为（Expected behavior）
3. 实际行为（Actual behavior）
4. 环境信息：Node 版本 / 浏览器版本 / 数据库版本（Environment: Node / browser / DB version）
5. 截图或报错日志（Screenshots or error logs，如有）

**功能建议请描述 / For feature requests, please describe：**

- 要解决什么问题（The problem you want to solve）
- 你设想的方案（Your proposed solution）
- 备选方案（Alternatives you considered）

---

## 如何提交代码 / How to Submit Code

1. **Fork** 本仓库，clone 你的 fork（Fork the repo and clone yours）
2. 创建功能分支（Create a feature branch）：`git checkout -b feat/your-feature`
3. 开发并**本地验证通过**（Develop and verify locally）
4. Commit 并推送（Commit and push）：`git push origin feat/your-feature`
5. 提交 Pull Request，**描述清楚改动内容和动机**（Open a PR with a clear description）

PR 合并前会检查（Before merge, CI will check）：

- 构建通过（Build passes）
- 核心单测通过（Core unit tests pass）
- 符合代码规范（Code style compliance）
- 无未声明的破坏性变更（No undeclared breaking changes）

---

## 代码规范 / Code Style

- **语言**：TypeScript 为主，前后端一致（TypeScript everywhere, front and back）
- **后端**：NestJS 模块化 —— 每模块 `module / controller / service / dto` 四件套；统一 `/api` 前缀、统一错误体 `{code, message}`、分页 `{list, total, hasMore}`、全量软删
- **前端**：Vue 3 `<script setup>` + Composition API；请求统一走 `lib/http.ts`（web）/ `src/api/client.ts`（admin）
- **命名**：REST 资源复数路径；DTO 入参 camelCase，兼容字段显式映射
- 使用仓库自带配置（ESLint / Prettier）保持格式一致

---

## 提交信息规范 / Commit Message Convention

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

feat(web): add marketplace filter by condition
fix(server): handle Prisma Decimal serialization in admin list
docs: add bilingual README and SEO keywords
test(server): cover check-in streak break logic
```

常用 type：`feat` / `fix` / `docs` / `test` / `refactor` / `perf` / `chore` / `style`

scope 示例：`web` / `server` / `admin` / `docs` / `db`

---

## 测试要求 / Testing Requirements

- **核心逻辑必须有单测**：签到防重、连续 / 断签、积分规则等（Core logic must have unit tests）
- 改动涉及 API 时，跑一遍冒烟链路：注册 → 登录 → 发帖 → 评论 → 点赞 → 签到 → 市集 → 搜索（Smoke-test the full API chain）
- 前端改动请在浏览器端到端自测关键页面（Verify key pages in the browser）

```bash
cd apps/server && npm test        # 服务层单测
```

---

## 社区公约 / Code of Conduct

参与本项目即表示你同意 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)（Contributor Covenant 2.1）。请保持友善、专业，尊重每一位贡献者。

---

再次感谢你的贡献！⭐ **如果这个项目对你有用，请点个 Star 支持我们！**
