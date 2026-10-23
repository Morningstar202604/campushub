# CampusHub 架构审查 + 技术债量化（Phase 1 产线）

> 角色：architect（高见远）+ tech-debt-strategist（贾积债）双视角并行
> 审查基线：v0.8.1（commit `00277c2` 之上），37 云函数 / 9 个 common-* 模块 / 333 份物理拷贝
> 所有结论带 `[来源]`，拿不出的标 `[待核实]`

## 【架构审查·高见远】

### 1. 重复部署反模式：333 份拷贝的 N 次方

`cloudfunctions/common/` 9 个文件（527 行，56K）被 `scripts/sync-common.js` 物理复制进 37 个函数目录 `[来源: scripts/sync-common.js:38-51]`。这是**平台约束逼出来的伪方案**——微信云开发每个云函数是独立部署单元，`require('../common')` 上云即炸（云端包里根本没有上一级目录）。但"同步复制"本身已经半步解决，真正的问题是**没有把同步做成不可跳过的构建步骤**。

三个改造方案：

| 方案 | 做法 | 代价 | 与云开发 CLI 兼容性 |
|---|---|---|---|
| **A. 构建期共享层打包** | webpack/esbuild 把 `common/` tree-shake 后打进每个函数 `dist/`，开发者工具指向产物目录 | 部署复杂度↑（多一条构建链），冷启动不变（代码量同），版本管理=Git LFS 管产物，回滚靠 tag | 好——产物仍是普通 Node 函数目录，`miniprogram-ci` 可直传；但本地调试与线上路径分叉，需双 require |
| **B. 云开发层（Layer）** | 腾讯云控制台建 Layer 挂 `/opt`，函数内 `require('../../opt/common-bundle')` | 部署复杂度↑（多一层控制台管理），冷启动**略升**（层解压在函数启动前），版本管理靠层版本号，回滚=改绑定 | **关键**：实测当前版本层管理在腾讯云控制台而非微信开发者工具内，且**小程序文档官方未收录**，仅腾讯云 CloudBase 文档有。开源给高校部署=要求每个学校会登腾讯云控制台建层，与"clone 即部署"的极简主张冲突 |
| **C. 合并为单函数路由** | 5-8 个领域函数（post / product / user / admin / guide / point / search / sys），内部 `event.action` 路由 | 部署复杂度↓（37→7），冷启动↓（复用实例概率↑），版本管理=单点，回滚=单函数回滚 | 最好——完全绕开公共层问题；但单函数体积增大、权限边界模糊、`wrap()` 需按 action 隔离 |

**推荐：分阶段走 A → C**。
- **短期（P0）保留 sync-common 但加硬约束**：把 `sync-common` 挂进 `prepublishOnly` 已做 `[来源: package.json:34]`，再补一个 `predeploy` 钩子 + CI 中跑 `doctor.js --strict`（已含 md5 漂移检测 `[来源: scripts/doctor.js:108-118]`）。这是 0 代价止血。
- **中期（P1）走方案 C 的"领域合并"**：37 个函数按资源域收敛到 ~8 个，common 自然内聚到一个包里。冷启动与部署成本双降。

**根本约束怎么破**：云开发确实**有** Layer（`/opt` 公共空间），出处 `[来源: docs.cloudbase.net/cloud-function/layer]`，但**不在微信开发者工具内**，需登腾讯云控制台管理。对开源高校场景，这等于把部署门槛从"clone+开发者工具"抬到"clone+腾讯云控制台"。**不建议作为主方案**，仅适合已有大规模团队且公共依赖体积大的场景。

### 2. 模块边界：9 文件扁平，职责倒挂

当前依赖图（来自 `common-*.js` 的 require 关系）：

```
common-bundle (纯 re-export)
├─ common-db        ← 零依赖（infra）
├─ common-error     ← 零依赖（infra）
├─ common-context   → db, error（domain）
├─ common-security  → db, error（domain，但 db 初始化被它隐式依赖）
├─ common-rate      → db（domain）
├─ common-content   → db, error, security（domain，但依赖 security.checkAdmin——倒挂）
└─ common-subscribe → db（domain）
```

**问题**：`common-content` 依赖 `common-security`（`removeContent` 调 `checkAdmin`），但 security 是横切关注点，被 content（具体领域）反向引用，属于**循环依赖前兆**。若新增 `common-comment` 也要鉴权，会同时依赖 security 和 content，扇出失控。

**最小分层建议**（transport / domain / infra 三层）：

```
infra/          common-db, common-error, common-rate（限流是横切，归 infra）
domain/         common-context, common-security, common-content, common-subscribe
transport/      common-bundle（纯 re-export，只被 index.js 引用）
```

落地：把 `common/` 拆成 `common/{infra,domain,transport}/`，sync-common 仍一键同步。`index.js` 继续 `require('./common-bundle')`，内部 bundle 按层级拼装。**0 行为变更，纯目录调整**，但未来加模块知道往哪层放。

### 3. 数据模型：有索引无 schema

`docs/INDEXES.md` 把 21 个集合的 41 个索引列得很细 `[来源: docs/INDEXES.md]`，但**没有任何一份文档写清每个集合的字段定义**。从 `cloudfunctions/*/index.js` 反推：

- `posts` 集合在 `post-create` 写入了 `userId/userNickname/userAvatar/schoolId/categoryId/categoryPath/category/kind/location/expireAt/resolved/resolvedAt/type/title/content/images/tags/isAnonymous/authorVerified/likeCount/commentCount/collectCount/viewCount/status/isPinned/isEssence/createdAt/updatedAt` 共 24 字段 `[来源: cloudfunctions/post-create/index.js:70-98]`，但 `post-update` 与 `post-delete` 又各自写了部分字段的 update，**没有 schema 校验层**——哪个字段谁能改，全靠人肉读代码。
- `users` 在 `common-context.js` 投影了 20+ 字段 `[来源: common-context.js:20-27]`，但 `user-update` 又独立写了一组字段，两边是否对齐**没有单一事实来源**。
- `likes/collects/checkins/follows` 四个"幂等计数"集合的唯一索引 `[来源: docs/INDEXES.md:67-83]` 是防并发双点的兜底，但字段名在 `like/index.js` 与 `collect/index.js` 各自硬编码，没有 schema 约束。

**缺失点**：一份 `docs/DATA_MODEL.md`（或 JSON Schema 文件），把每个集合的字段、类型、必填、唯一性写死。这是开源给高校部署最容易被"魔改"翻车的点——字段名拼错一个字母，列表就静默空白（INDEXES.md 第 122 行自己也承认了这一点 `[来源: docs/INDEXES.md:122]`）。

### 4. 扩展性：函数数随资源类型线性膨胀

现状：37 个函数 = 资源 × 动作（post-create/delete/list/detail/update、product-×、comment-×、like、collect、follow、checkin、report...）。**新资源类型（如"二手商品"变"团购"）= 新增 4-5 个函数 + 前端 callFunction 改一遍**。37 已接近 `miniprogram-ci` 上传 37 个独立包的手感上限（DEPLOY.md 自己也写"新人部署 0.5~1 天" `[来源: docs/EXPERT_REVIEW_AND_ROADMAP.md:39]`）。

**中间态方案**：按**领域**合并 8 个函数，内部 action 路由：

```
campushub-post    (post-create/delete/list/detail/update + task-expire)
campushub-product (product-create/delete/detail/list/update)
campushub-comment (comment-create/delete/list)
campushub-social  (like / collect / follow / checkin / points)
campushub-admin   (admin / report / resolve / announcement / feedback-create)
campushub-guide   (guide-list/detail/create/update + guide_categories)
campushub-user    (login / verify / user-profile / user-update / my-list / notification)
campushub-sys     (search / category-list / category-manage / init-db / backup-db)
```

代价：单函数代码量 ~3-4KB × 8 ≈ 24KB，仍在云函数 50MB 体积限制内**两个数量级余量**；冷启动复用概率↑（同域多 action 共享实例）；`wrap()` 需按 action 隔离，避免一个 action 的异常拖垮整个函数（可用 `Map<action, handler>` + try/catch 封装解决）。**前端零改动**——`callFunction('campushub-post', { action: 'create', ... })` 等价于现在的 `callFunction('post-create', ...)`。

---

## 【技术债盘点·贾积债】

### 1. 债务利息量化

**333 份拷贝 = 37 函数 × 9 common 文件**（含 bundle，527 行）。

一次 `common-security` 修复的实际工序：
1. 改 `cloudfunctions/common/common-security.js`
2. 跑 `npm run sync:common`（`sync-common.js` 复制 9 文件 × 37 目录 = 333 次 `fs.copyFileSync` `[来源: scripts/sync-common.js:48]`）
3. 跑 `npm run doctor`（37 目录 × 9 文件 md5 比对 = 333 次 `crypto.createHash('md5')` `[来源: scripts/doctor.js:108]`）
4. `npm run deploy`（`miniprogram-ci` 上传 37 个函数，每个包内含 9 份 common ≈ 56K 重复上传）

**部署成本**：37 次独立上传，每次包内含 9 份 56K common = **2.07MB 重复字节**/轮次。云开发按"调用次数 + 资源大小"计费，37 个函数即便各只被调 1 万次/月，存储冗余也在 ¥ 级别累计（19.9 月费基础包内可忽略，但 10 万+ 调用后存储 GB·h 会显现）。

**维护工时粗估（2 人团队）**：
- 每次 common 改动：10 min 改代码 + 1 min sync + 1 min doctor + 5 min 上传验证 = **17 min/次**
- 假设每月 common 改动 8 次（安全修复 / 错误文案 / 限流参数 / 幂等键...）= 136 min ≈ **2.3 h/月纯同步开销**
- 加上"忘了 sync 导致线上版本不一致"的排查成本：估计每季 1 次，每次 2-4h = **0.7 h/月摊薄**
- **债务利息 ≈ 3 h/月/2 人 = 1.5 h/月/人**（约 0.09 人月/月）。看似不多，但这是**纯摩擦成本**，没有任何用户价值。37 个函数如果砍到 8 个，同步开销直接 ×(8/37) = **0.3 h/月/人**，省 80%。

### 2. 重构优先级（P0/P1/P2）

**P0：公共层硬约束 + 单一事实来源**（已半解决，只差最后一公里）
- `sync-common.js` 已存在 `[来源: scripts/sync-common.js]`，`doctor.js` 已有 md5 漂移检测 `[来源: scripts/doctor.js:108-118]`，`prepublishOnly` 钩子已挂 `[来源: package.json:34]`。
- **还差**：`predeploy` 钩子（目前 `deploy.js` 没有自动调 sync+doctor，靠人肉跑 DEPLOY.md checklist `[来源: docs/DEPLOY.md:7-20]`）+ CI 中 `doctor.js --strict` 阻断。
- **先做**：`package.json` 加 `"predeploy": "node scripts/sync-common.js && node scripts/doctor.js --strict"`，`.github/workflows/deploy.yml` 加一个 CI job。
- **不做**：不要现在动目录结构（common 拆 infra/domain/transport 是 P1，P0 只要"不能跳过的检查"）。
- **为什么这个顺序**：P0 是 0 行为变更的纯保险丝，先把"333 份拷贝会漂移"的尾部风险砍掉，再谈结构优化。

**P1：领域合并 37→8**（见架构部分方案 C）
- 收益：部署 37→8、存储冗余 87%↓、common 自然内聚、前端 callFunction 改 37→8 个函数名（一次性 2h）。
- 风险：`wrap()` 需按 action 隔离；8 个函数中 `campushub-admin` 体量最大（admin/report/resolve/announcement/feedback ≈ 500+ 行），冷启动略升但实例复用抵消。
- **先做**：写 `campushub-post` 试点（post-create/delete/list/detail/update 5 个 action 合并），验证 `Map<action,handler>` 模式 + 错误隔离，再铺开到其余 7 个域。
- **不做**：不要一次性改 37 个，试点 1 个域跑通再铺。

**P2：schema 单一事实来源**（`docs/DATA_MODEL.md` + 可选 JSON Schema 校验层）
- 收益：高校魔改不再翻车；`init-db` 可自动校验字段存在性。
- 代价：写 21 个集合的字段文档 ≈ 4h；加运行时校验层 ≈ 1d。
- **为什么 P2**：不影响部署正确性（索引已建全），只是"降低魔改门槛"，优先级低于功能正确性。

### 3. 两条备选路线（不藏代价）

**保守路线：保留 37 函数，只修 sync 脚本**
- 代价：P0 全做（~2h）+ 每月 1.5h/人摩擦成本 + 每新增资源类型 +4-5 函数（线性膨胀不停）+ 高校部署 0.5-1 天上手成本永在。
- 收益：0 重构风险，行为 100% 不变，CI 改动最小。
- 适合：**已经部署到 3 校以上、不敢动后端的稳态期**。

**激进路线：合并到 5-8 个领域函数**
- 代价：P1 全做（试点 1d + 铺开 2d + 前端改名 2h）+ 单函数 24KB 体积 + `wrap()` 按 action 隔离的测试覆盖（需补 8 × N 个 action 的集成测试）+ 回滚从"37 个函数各自回滚"变"8 个函数回滚"（粒度变粗，**回滚 1 个坏 action 要回滚整个领域函数**）。
- 收益：部署 37→8、存储冗余 87%↓、每月摩擦成本 1.5→0.3h/人、新增资源类型成本从"+4-5 函数"变"+1 函数内 1 个 action"。
- 适合：**还在开源冷启动期、希望高校 clone 即部署的低门槛期**。

**我的倾向**：先 P0 止血（保守路线，1 天落地），再 P1 试点 1 个域验证（激进路线的保险丝），跑通后铺 P1 全量。**不要一步到位**——37 个函数的行为回归测试需要补 8 × 平均 5 个 action = 40 个集成用例，P2 的 schema 层也要同步上，否则合并后字段写错没有拦截。

---

## 技术债 Top5 清单

| # | 问题 | 影响 | 建议 | 代价 |
|---|------|------|------|------|
| 1 | **333 份 common 物理拷贝无 `predeploy` 硬约束** | 忘 sync → 线上版本不一致 → 难排查；每月 1.5h/人摩擦 | P0：`prepublishOnly` 已挂，加 `predeploy` + CI `doctor --strict` | 2h，0 行为变更 |
| 2 | **函数数随资源类型线性膨胀（37 已接近部署上限）** | 新增资源 = +4-5 函数 + 前端改一遍；高校部署 0.5-1 天 | P1：领域合并 37→8，内部 action 路由 | 3d，需补 40 集成用例 |
| 3 | **9 个 common 文件扁平、职责倒挂（content→security 循环依赖前兆）** | 加新模块扇出失控；`common-content` 与 `common-security` 无法独立演进 | P1 顺手：拆 `common/{infra,domain,transport}/`，0 行为变更 | 2h，纯目录调整 |
| 4 | **无 schema 单一事实来源（21 集合字段散落 37 函数）** | 高校魔改拼错字段 → 列表静默空白（INDEXES.md:122 自认）；`users` 字段在 context 与 user-update 两处独立维护 | P2：写 `docs/DATA_MODEL.md` + 可选运行时 JSON Schema 校验 | 4h 文档 + 1d 校验层 |
| 5 | **`wrap()` 统一错误出口但无 per-action 隔离（合并后成 P0）** | 合并到 8 域函数后，1 个 action 异常可能拖垮整个领域函数 | P1 试点时加 `Map<action,handler>` + 独立 try/catch | 0.5d（试点期含） |

---

*333 份拷贝，复制粘贴的 N 次方。平台约束逼出来的伪方案不可怕，可怕的是它成了"看起来能跑"的舒适区——sync-common.js 已经半步解决，剩下的 50% 才是真债。*
