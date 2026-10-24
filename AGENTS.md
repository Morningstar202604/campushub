# AGENTS.md — CampusHub

开源校园内容社区，一套代码出三端（微信小程序 / H5 / Android）。**uni-app (Vue 3 + Vite) + 腾讯 CloudBase**。v0.12.0。

## 结构

- `uni-app/` — 前端主体（小程序端构建在此目录内）
- `cloudfunctions/` — 云函数，构建产物由 `scripts/build-functions.js` 生成
- `tests/` — `node --test` 单测 + `tests/frontend/` 前端测试
- `scripts/` — `deploy.js` / `build-functions.js` / `gen-gateways.js` / `contract-check.js` / `doctor.js` / `ui-lint.js` / `verify-release.js`
- `gateway-routes.json` — 唯一事实源（手工维护），网关入口/前端路由**由它生成**，不要手改生成物

## 验证（改完必须跑）

```bash
npm run gate      # 8 阶段：gen:gateways:check → build:functions → build:functions:check
                  #        → contract → lint:js → format → test → test:frontend
                  # 当前基线：后端 244 / 前端 42，全绿
npm run verify    # 发布级静态校验：页面映射 / 版本徽章 / 治理文件 / 云函数结构
npm run lint      # UI 层 lint：隐私接口清单 / 全局原子类重定义 / 空态 emoji
cd uni-app && ./node_modules/.bin/vue-tsc --noEmit   # 前端类型检查（CI 也跑）
```

只跑单项：`npm test`（后端单测）/ `npm run test:frontend` / `npm run lint:js` / `npm run contract`。

> 注意：`npx vue-tsc` 在 Node 24 下会因 npm 缓存里的旧版本报 `ERR_PACKAGE_PATH_NOT_EXPORTED`，
> 必须用 `uni-app/node_modules/.bin/vue-tsc`。

## 部署

- 开发环境：`npm run deploy:dev`
- **生产：`npm run deploy`（`--env prod`，会影响真实用户）——执行前必须确认**
- 小程序端：`cd uni-app && npm run build:mp-weixin`
- 安卓 APK：`npm run build:apk`

## 硬约束

- 改 `cloudfunctions/` 后必须重跑 `npm run build:functions`，产物与源码保持一致（`gate` 会检查）
- 新增业务入口：先加 handler 源码 → 在 `gateway-routes.json` 登记 → `npm run gen:gateways` 重生成网关与前端路由（`gate` 检查一致性）
- 云函数与前端之间的契约由 `npm run contract` 校验，改字段要两边一起改
- 小程序端不能用浏览器专属 API（`window` / `document`）；平台差异走条件编译
- 提交前 `npm run format`（prettier）与 `eslint` 都要过

## 不要碰

- `node_modules/`、`dist/`、`uni-app/dist/`（`out/` 是本地 APK 产物，不入库）
- `gateway-routes.json` 手改（走 `gen:gateways`）
- `deploy.config.json`（含云环境 ID / 密钥，参考 `deploy.config.example.json` 新建本地副本）
- 生产环境部署命令，除非用户明确要求
- 历史文档已归档到 `docs/archive/`，不要再按那里的结论操作
