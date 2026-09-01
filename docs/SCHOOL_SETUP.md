# 一校一署部署指南（换校模板）

CampusHub 定位为"一套代码 → 一校一个云环境 → 校内深耕"。部署新学校时，
只需按本清单替换学校信息，无需改动业务代码。

## 1. 配置模板

```bash
cp config/school.default.json config/school.json
# 编辑 school.json：填写 schoolName / schoolId / adminOpenids / guideCategories
```

## 2. 换校要改的 4 处（其余都不用动）

| # | 位置 | 内容 | 说明 |
|---|------|------|------|
| 1 | `config/school.json` | 学校名 + schoolId | 部署时的数据来源 |
| 2 | 云函数环境变量 `SEED_SCHOOL_NAME` / `SEED_SCHOOL_ID` | init-db 种子学校 | 调 init-db 时按此初始化指南分类与种子内容 |
| 3 | 云函数环境变量 `ADMIN_OPENIDS` | 本校区管理员 openid | 逗号分隔，多个管理员 |
| 4 | `miniprogram/app.js` 的 `env` | 本校区云开发环境 ID | 每个校区一个独立云环境 |

> 多校区 = 多套云环境 + 各自环境变量。**不共享同一云环境**，数据天然隔离。

## 3. 部署流程（约 10 分钟）

```bash
npm install && npm run sync:common && npm run doctor
# 微信开发者工具逐个上传 37 个云函数（或 scripts/deploy.js 自动化）
# 配置环境变量：SEED_SCHOOL_NAME / SEED_SCHOOL_ID / ADMIN_OPENIDS / INIT_SECRET / TMPL_*
# 调 init-db 建集合/索引/种子内容 → 确认 missingIndexes 为空
# app.js 替换 env → 预览发布
```

## 4. 上线前必做

1. 调用 `init-db` 直到 `missingIndexes` 为空（索引见 docs/INDEXES.md，36 个）
2. 配置 `backup-db` 定时触发器（自动每日备份）
3. 配置内容安全 API 权限（见 docs/DEPLOY.md 第八步）
4. 合规检查（见 docs/COMPLIANCE.md）
