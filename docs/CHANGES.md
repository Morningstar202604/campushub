# CHANGES.md — 本次改造审阅清单（Campushub · 2026-09-21）

> 来源：全栈开发战队对 `https://gitcode.com/badhope/campushub.git` 的严苛审查（`AUDIT_REPORT.md`）后，
> 用户选定「**全部三档·含体验扩展** + **只改文件不提交**」执行。
> 本文件为交付审阅清单：逐项列出「改了什么 / 为什么 / 如何验证 / 上线前需运营动作」。
> **未提交 git**——请按本清单 review 后自行 `git add` / 拆分提交。

---

## 0. 变更总览（已剔除 `miniprogram_npm/` 出库）

| 类别 | 数量 | 说明 |
|---|---|---|
| 修改文件（M） | 195 | 含 44 个云函数的 common kernel 同步副本 |
| 新增文件（??） | 12 | 配置 / 工具 / 文档 / 多校隔离 config |
| 删除文件（D） | — | `miniprogram_npm/dayjs/*` 等出库（`.gitignore` 接管，重新构建 npm 生成） |

**4 门禁回归结果**（改造后实测）：

| 门禁 | 命令 | 结果 |
|---|---|---|
| 单元测试 | `npm test` | ✅ 25/25 通过（4 个测试文件） |
| 发布校验 | `npm run verify` | ✅ 全绿 |
| 契约检查 | `npm run contract` | ✅ 通过 |
| UI lint | `npm run lint` | ✅ 通过 |
| common 同步 | `npm run sync:common --check` | ✅ 指纹一致（无漂移） |

> 注：`miniprogram_npm/` 出库后，**首次部署前**需在微信开发者工具 → 工具 → 构建 npm 重新生成，
> 再部署（详见 `docs/DEPLOY.md` 第三步 / `docs/NPM_TRIM.md`）。

---

## 档位 1 —— 安全与数据层（security-engineer · 孔安全）

> 目标：堵住 OWASP Top10 关键漏洞 + 数据一致性 + 越权。
> 改动面：`cloudfunctions/common/` kernel（common-security.js / common-content.js / common-db.js / common-indexes.js）
> 经 `sync:common` 同步到全部 44 个云函数副本 + 各 `index.js` 业务逻辑。

### 1.1 关键修复项
| 项 | 修复 | 文件 |
|---|---|---|
| 身份伪造（IDOR） | 所有读/写操作经 kernel `assertAuth` 校验 `OPENID`，资源属主比对 | `common-security.js` + 各 `index.js` |
| 注入 | 用户输入统一 `escapeHtml` + 参数白名单，云函数不再拼接原始字符串 | `common-content.js` |
| 越权删除 | 删除/编辑限属主或管理员，`canDelete/canEdit` 服务端重算 | `common-security.js` |
| 幂等去重 | `idempotency` 集合 + 唯一索引 `idx_idempotency_reqid`，`clientReqId` 防双击重发 | `common-db.js` / `common-indexes.js` |
| 内容审核前置 | 发帖/评/品先过 `common-content` 敏感词 + 长度上限，命中即拒 | `common-content.js` |
| 密钥/日志脱敏 | 错误日志不泄 stack/内部路径，对外统一错误码 | `common-error.js`（测试覆盖） |

### 1.2 业务 `index.js` 改动（8 处）
`admin / init-db / post-create / post-list / product-create / search / task-expire / user-profile`

- 接入 kernel 鉴权与幂等；`task-expire` 改懒过期（不依赖定时器，查询时判过期）。
- `post-create/product-create` 落 `clientReqId` 幂等键。

---

## 档位 2 —— 架构与可维护性（architect · 高见远 / tech-debt · 贾积债）

### 2.1 多校隔离
- **新增 `miniprogram/config/school.js`**：单点注入 `envId`（每校 clone 后只改这一个文件）。
- `miniprogram/app.js` 的 `wx.cloud.init` 改为 `env: getSchoolConfig().envId`，
  彻底消除散落在各处的硬编码 env。

### 2.2 common kernel 同步机制
- `cloudfunctions/common/` 为唯一 kernel 源，`scripts/sync-common.js` 把 9 文件拷到每个云函数副本。
- **新增 `cloudfunctions/common/.sync-manifest.json`**（SHA1 指纹）防漂移；`--check` 门禁可校验。
- **新增 `cloudfunctions/common/package.json` + `package-lock.json`** 锁定 common 依赖。
- `prepublishOnly` 钩子自动 `sync:common`。

### 2.3 文档
- `docs/architect-and-debt-review.md`：架构 ADR + 技术债盘点 + 三档路线。

---

## 档位 3 —— 体验与工程扩展（frontend-engineer · 慕前端 / 主理人收尾）

### 3.1 数据刷新竞态消除（needRefresh → eventBus）
- **新增 `miniprogram/utils/eventBus.js`**：`on/off/emit` 订阅式刷新，替代 `app.globalData.needRefresh`
  全局标志（旧机制「发布后各页 onShow 读一次即清零」→ 第一个消费页清零后，后续页漏刷）。
- 消费页改订阅 `data-changed`：
  `index / post-detail / product-detail / my-list / wall / market / lost-found`
- 生产页 `post-publish / product-publish` 发布/编辑成功后 `emit('data-changed', { type })`。
- `miniprogram/app.js` 移除 `globalData.needRefresh` 字段。

### 3.2 代码规范门禁（eslint / prettier / husky）
- **新增 `eslint.config.js`**（flat，忽略 `cloudfunctions/*/common/**`、`miniprogram_npm`）
  + `.eslintrc.json`（legacy 兼容）+ `.prettierrc`（`semi:false / singleQuote / width:100`，与现库一致）。
- **新增 `.husky/pre-commit`**：仅查暂存 `.js`（排除 common 副本）；本地未装 eslint 时放行，CI 强卡。
- `package.json` 新增 devDeps `eslint@8.57.1 / prettier@3.6.2`，
  scripts `lint:js / lint:js:fix / format / format:fix`。
- ⚠️ 本地无 lockfile、未拉网络装包，**ESLint/Prettier 实际执行由 CI 兜底**（钩子已自洽设计：装后即强制）。

### 3.3 无障碍（a11y）首批 P0/P1
> 全仓此前 `aria-*` / `role=` 命中 **0**（审计判定「系统性缺失」）。本次落地**首批高价值核心可交互元素**
> 而非铺满 150+ 处（避免 wxml 大面积改动导致回归风险）。已落地：
| 文件 | 标注 |
|---|---|
| `post-detail.wxml` | 操作条 9 处：点赞/评论/收藏/海报/编辑/删除/解决/举报 → `role="button" aria-label` |
| `product-detail.wxml` | 底部操作条 5 处 + 轮播图/头像 `alt` |
| `search.wxml` | 结果 Tab 3 处 `role="tab"` + 历史/热搜标签 `role="button"` |
| `admin.wxml` | 分类管理快捷入口 `role="button"` |
| `profile.wxml` | 编辑/签到 `role="button"` |
| `profile-edit.wxml` | 改名卡兑换 `role="button"` |
| `post-publish / product-publish.wxml` | 发布主按钮 `aria-label` |
| `index / market / user-profile` | 关键 `<image>` 补 `alt`（共 12 处） |
| `admin/admin.js` 等 | 对比度项（`#999`/`#BFBFBF` < 4.5:1）留作后续 P1 色板调整（未动 wxss） |

### 3.4 首屏骨架
- `index.wxml` 已有 `skeleton-card / skeleton-block`（保留），加载态不空白。

### 3.5 文档
- `docs/NPM_TRIM.md`：miniprogram_npm 出库 + 重新构建说明。
- `docs/DEPLOY.md / OPERATIONS.md / INDEXES.md / README.md / README.zh-CN.md` 同步更新。

---

## 4. 上线前需运营/DB 动作（**代码不能自动完成，需人工执行**）

> 来自档位 1/2 的数据库变更，须在 CloudBase 控制台或 `init-db` 云函数里落地：

| 动作 | 说明 | 位置 |
|---|---|---|
| 建 3 个索引 | `idempotency.idx_idempotency_reqid`（唯一）等 | `common-indexes.js` 已声明，需 `init-db` 执行 |
| 建 1 个 TTL 索引 | `idempotency` 过期自动清理 | 同上 |
| 构建 npm | `miniprogram_npm/` 出库后，开发者工具 → 工具 → 构建 npm | `docs/NPM_TRIM.md` |
| 多校 env | 各校 clone 后只改 `miniprogram/config/school.js` 的 `envId` | `docs/DEPLOY.md` |

---

## 5. 交付验收 checklist（对齐战队规则 #16）

- [x] 可运行代码（4 门禁全绿）
- [x] 测试套件（`npm test` 25/25）
- [x] CI 配置（`.github/workflows/ci.yml` 已更新门禁）
- [x] 部署脚本（`scripts/deploy.js` + `docs/DEPLOY.md`）
- [x] 依赖锁定（`cloudfunctions/common/package-lock.json`；根 package.json 锁 devDeps）
- [x] 安全报告（档位 1 → `AUDIT_REPORT.md` § 安全）
- [x] 无障碍报告（档位 3 → `AUDIT_REPORT.md` § 5.2 + 本文件 3.3）
- [x] 回滚预案（common kernel 有 `.sync-manifest.json` 指纹，`git checkout` 可回退）
- [ ] 性能报告（档位 5 未单独立项；task-expire 已改懒过期，作为 P2 优化项）
- [ ] 全量 a11y（本次首批 P0/P1；150+ 处可点击 view + 4 处对比度留作后续）
- [ ] 提交 git（**用户要求「只改文件不提交」，本清单即用于人工 review 后提交**）

---

## 6. 建议的提交拆分（人工 review 后）

1. `feat(security): kernel 鉴权/幂等/内容审核 + 8 个 index.js 接入`
2. `feat(multi-school): config/school.js 多校隔离 + common kernel 同步机制`
3. `feat(fresh): eventBus 替代 needRefresh + eslint/prettier/husky + a11y 首批`
4. `docs: AUDIT_REPORT / CHANGES / DEPLOY / NPM_TRIM 等文档`
