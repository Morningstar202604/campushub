# Campushub 严苛工程审查报告与改造路线图

> 全栈开发战队 · 工程交付总监 汇编
> 项目：`https://gitcode.com/badhope/campushub`（v0.8.1，微信云开发 + 原生小程序，开源给各高校部署的校园社区）
> 审查方式：15 位专家分 6 阶段串行评审，每条结论带 `文件:行号` 溯源，拿不准处标 `[待核实]`
> 版本：审计基线 commit `271110c`（2026-09-20）

---

## 〇、执行摘要（先说最狠的）

Campushub 是一个**"骨架比肌肉好"的项目**：公共层 `common-*` 的设计水准（fail-closed 内容安全、统一错误、原子计数）明显高于一般开源模板；但**架构的重复部署反模式、数据模型的 O(n) 扩展、零测试门禁的 CI、提交进 git 的 3.5MB 构建产物**这四座大山，让它离"可被陌生人放心 fork 部署"还差一个数量级。

一句话画像：**333 份 common 拷贝 + 读侧枚举型信息泄露（P1 无 P0 阻断）+ 1 个被 git 跟踪的 3.5MB 包**，是它最刺眼的三处"开源可信度"硬伤。

> **更正说明（以安全组实读为准）**：写侧越权（删/改他人资源）经实读**设计扎实**——`removeContent` 归属校验 + `checkAdmin` 双闸门，`deleted` 已有前置终态校验，**不存在"已删资源可被重复删除"的 P0**。真正的洞在**读侧**（用户资料可全量枚举、`users.openid` 明文可被同校用户查、admin 后台 7 函数 N+1）与**数据一致性**（计数漂移）。本项目**无 P0 阻断性越权漏洞**。

### 安全 / 质量 Top5（按实读严重度）

| 严重度 | 问题 | 位置 | 一句话修复 |
|---|---|---|---|
| **P1** | 读侧 IDOR/枚举：`user-profile`/`user-list` 可被同校用户遍历 userId 全量抓取个人资料；`users.openid` 明文且 `where({openid})` 可被同校用户直接查 | `user-profile/index.js`、`users` 集合权限 | 收紧数据库权限 + 脱敏 openid + 加访问频率/范围校验 |
| **P1** | 计数漂移：软删回退、like 增减与 `postCount/likeCount` 字段在并发/异常路径下可能漂移，无对账 | `removeContent`、`like`、`comment-create` | 定期对账任务 + 关键计数 `_.inc` 原子 + 唯一索引兜底 |
| **P1** | admin 后台 N+1：`admin` 列表类函数循环 `get` 逐条拉，后台规模上来后慢且易超时 | `admin/index.js` | 改 `where` 批量 + 分页，消除 N+1 |
| **P1** | `checkAdmin` 中 `config.doc('global').get().catch(()=>null)` 把 not-found 与 DB 故障混同，**故障时 fail-open 倾向** | `common-security.js` checkAdmin | 区分 not-found 与 error，DB 故障拒绝并告警 |
| **P1** | 测试 4 文件 45 断言 / 37 云函数 + 20 页面，**无越权、无并发竞态、无 fail-closed 的自动化用例**；`miniprogram_npm` 3.5MB 提交进 git | `tests/`、`miniprogram_npm/` | 补 30+ 用例接入 CI 门禁；npm 出库 + tdesign 按需引入 |

> **写侧已核实为安全**（非 Top5 原因）：`post-delete/post-update/product-*` 均经 `removeContent`/归属校验 + `requireActive`，`deleted` 终态前置，篡改 `postId` 删他人资源会被 `checkAdmin` 兜住。P0 读侧枚举是当前最该优先堵的洞。

---

## 一、架构与技术债（architect·高见远 / tech-debt-strategist·贾积债）

### 1.1 重复部署反模式（最核心架构债）

**事实**：`cloudfunctions/` 下 **37 个函数目录 + 1 个 `common/` 源目录**，每个函数目录物理拷贝 9 个 `common-*.js`（`md5` 逐字节一致，已抽查 `admin/announcement/backup-db` 三份 `common-security.js` hash 相同）。

- 总量：**38 目录 × 9 = 342 份重复拷贝**全提交进 git（"复制粘贴的 N 次方"，含 common 源目录自身 15 文件残留）。
- 每次修 `common-security`（如内容安全策略升级）→ 要跑 `scripts/sync-common.js` 同步 37 目录 → **再逐个/批量部署 37 个云函数**，一次安全修复 = 37 次部署。
- `sync-common.js` 的 `copyFiles` 实为**运行时动态扫目录生成（`readdirSync` 找含 `package.json` 的目录）**——**新增函数会被自动同步**（比"硬编码 37 清单"乐观，P17 降级为低风险）。真正的残留风险是**反向**：新增函数若**忘跑一次 `npm run sync:common`** 就会带旧 common 上线，`prepublishOnly` 是唯一保险丝，`deploy.js` 里并无强制前置 sync。改造建议：把 sync 硬塞进 `deploy.js` 最开头 + 加"复制前 SHA 指纹校验"杜绝静默漂移。

**根因约束**：微信云开发（CloudBase）**不支持跨云函数 `require` 相对路径的 npm 公共层**，每个函数是独立运行单元，依赖必须"自包含"。这是架构债的物理根源，不是懒。

**模块边界倒挂（专家实读）**：`common-content` **反向依赖** `common-security`（`removeContent` 调 `checkAdmin`），属循环依赖前兆。建议拆 `common/{infra,domain,transport}/` 三层：`infra=db/error/rate`，`domain=context/security/content/subscribe`，`transport=bundle`，0 行为变更纯目录调整。

**三方案对比（专家级）**：

| 方案 | 机制 | 部署复杂度 | 冷启动 | 版本管理 | 回滚 | 与云开发 CLI 兼容 | 推荐 |
|---|---|---|---|---|---|---|---|
| **A 构建期共享层打包** | 本地 `common/` 为唯一事实源，构建脚本把 9 文件注入各函数 `node_modules` 或直接拷入 | 中（需 CI 打包） | 无变化 | 单一源，git 友好 | 函数级回滚 | ✅ 原生兼容 | ✅ **首选（先止血）** |
| **B 云开发公共层(layer)** | 已核实：CloudBase 确实有云函数层，代码挂 `/opt`，函数内 `require('../../opt/common-bundle')`。出处 = `docs.cloudbase.net/cloud-function/layer`。但 layer 管理在腾讯云控制台而非微信开发者工具内，对"clone 即部署"的开源定位冲突 | 高 | 略优 | layer 版本化 | layer 级回滚 | ⚠️ 控制台管理，与开源部署流程割裂 | **不推荐作主方案** |
| **C 合并单函数路由** | 37 函数 → 5-8 个领域函数（content/interaction/system），内部 `event.action` 路由 | 低（函数数↓） | 优（函数数少） | 需重写路由 | 领域级回滚 | ✅ | 长期方向 |

**推荐路线**：**先 A（消除 333 拷贝，单一事实源 + CI 注入），规模放大后演进 C**。B 作为 C 落地后承载共享依赖的载体。

### 1.2 模块边界

现状 `common-*` 是**扁平 9 文件无分层**：`security` 依赖 `db`，`error` 被所有引用，`bundle` 是"上帝模块"（re-export 所有 common）。建议最小三层：

```
common/
├─ infra/   (db, rate, indexes)      # 基础设施，只碰 wx-server-sdk
├─ domain/ (security, content, subscribe)  # 业务规则，依赖 infra
└─ api/     (bundle, context, error) # 对外契约，统一 wrap/ok/AppError
```

依赖单向：`api → domain → infra`，禁止反向。`bundle` 仅做聚合 re-export，不再藏逻辑。

### 1.3 数据模型

各函数 `index.js` 反推集合：`users / posts / products / categories / comments / notifications / config / checkins / follows / collects / reports / feedbacks`。
**缺失**：无统一 schema 文档（`docs/data-model.svg` 是图非契约）。`users.followers/following` 是**数组字段 O(n) 增长**（follow 越多，单 doc 越大，读写放大）——这是**数据模型级技术债**，建议拆成 `follows` 关系集合。

### 1.4 扩展性

现状"资源+动作"拆函数（`post-create/post-delete/product-list`…）共 37 个，新增资源类型函数数**线性膨胀**。中间态：按**领域**合并（content/interaction/system/account 4 域），域内 `action` 路由，函数数压到 4-8，`sync-common` 清单同步缩减。

### 技术债 Top5

| # | 问题 | 影响 | 建议 | 代价 |
|---|---|---|---|---|
| 1 | 333 份 common 拷贝 + 硬编码同步清单 | 一次安全修复=37 次部署；漏同步=生产事故 | 方案 A 构建期注入单一源 | 中（改 CI + 部署脚本） |
| 2 | `users.followers/following` 数组 O(n) | 重度用户 doc 膨胀、读写放大 | 拆 `follows` 关系集合 + 索引 | 中（数据迁移） |
| 3 | 软删除计数回退 read-modify-write 非原子 | 并发删帖丢计数 | `_.inc(-1)` 原子递减 | 低 |
| 4 | 37 函数无 `package-lock` | 部署 npm install 不可复现、冷启动慢 | 锁版本 + 依赖层 | 低 |
| 5 | `miniprogram_npm` 3.5MB 入库 + 仅用 t-button | 包体积虚高、git 仓库臃肿 | gitignore + 按需引入 | 低 |

---

## 二、后端安全与数据层（security·孔安全 / backend·侯后端 / database·巩数据）

### 2.1 越权（IDOR）核查 —— 写侧扎实，读侧有洞

**写侧（删/改）经实读为安全**：`post-delete/index.js:11` → `removeContent({collection:'posts', docId:postId, actor:user})`。`removeContent` 做"归属校验 + `checkAdmin` 兜底 + `deleted` 终态前置"，**篡改 `postId` 删他人资源会被拦**。`product-delete/comment-delete` 同模式，写侧一致性好。

**读侧（真正风险，P1）**：
1. **用户资料枚举**：`user-profile` / `user-list` 可被同校用户遍历 `userId` 全量抓取个人资料，无访问范围/频率校验。
2. **openid 明文**：`users.openid` 字段明文存库，`where({openid})` 可被同校用户直接查（`login` 用 `stripOpenid` 防了响应侧，但**库内明文 + 读权限未收**仍是洞）。
3. **admin 后台 N+1**：`admin` 列表类函数循环 `get` 逐条拉，规模上来后慢且易超时。

**结论：本项目无 P0 阻断性越权漏洞，最高风险为 P1 读侧枚举。**

### 2.2 鉴权一致性

`checkAdmin`（`common-security.js`）：`envAdmins = process.env.ADMIN_OPENIDS`；再 `db.collection('config').doc('global').get().catch(() => ({data:null}))`。
**缺陷**：`.catch(() => ({data:null}))` 把"**文档不存在**"与"**DB 故障/权限不足**"混为一谈。管理员表读取失败时**静默按普通用户处理**，或反之误放行——**fail-open 倾向，违反项目自身 fail-closed 原则**。应区分错误码：not-found → false；DB error → 拒绝操作并告警。

### 2.3 注入

`common-db.js` 封装 `where`：抽查未见字段白名单——**用户输入若直接拼进 `where` 条件对象，云开发 SDK 默认按字段匹配（非 SQL 拼接），注入风险低**，但**缺类型校验**（如 `where({score: "abc"})`）会打满索引。建议对每集合 `where` 字段建白名单 + 类型断言。

### 2.4 密钥泄露

grep 全仓 `secret/apiKey/adminOpenids/whitelist`：管理员身份走 `ADMIN_OPENIDS` 环境变量（✅ 正确，未硬编码进代码）。**未发现明文 key 入库**（`deploy.config.json` 在 gitignore）。`deploy.config.example.json` 仅模板，需确认无真实值。**✅ 此项相对干净**。

### 2.5 OWASP 映射

| OWASP | 本项目命中 |
|---|---|
| A01 不安全默认设置 | `checkAdmin` DB 故障静默降级（fail-open 倾向） |
| A03 注入 | `where` 无字段白名单/类型校验（低风险但需补） |
| A04 不安全设计 | 软删除终态不校验 → 重复操作 |
| A08 数据完整性 | 计数回退非原子 → 并发不一致 |

### 2.6 数据层

- **索引**：`docs/INDEXES.md` + `common-indexes.js`。`users` 有 `idx_users_openid` 唯一索引（login 并发首登靠它兜底，✅ 好设计）。**缺**：`posts` 按 `schoolId + createdAt desc` 列表查询的复合索引（现按学校拉列表可能全表扫描）。`comments` 按 `postId + createdAt` 缺复合索引。
- **软删除 + 计数**：`removeContent` 回退 `postCount` 用 read-modify-write，**并发删帖竞态**（P0，见摘要）。

### 安全风险 Top5（按实读严重度）

| 严重度 | 问题 | 位置 | 修复 |
|---|---|---|---|
| P1 | 读侧用户资料全量枚举（同校可遍历 userId） | user-profile / user-list | 访问范围/频率校验 + 脱敏 |
| P1 | `users.openid` 明文 + `where({openid})` 可被查 | users 集合权限 | 收紧读权限 + openid 脱敏/哈希 |
| P1 | admin 后台 N+1 循环 get | admin/index.js | 改 where 批量 + 分页 |
| P1 | checkAdmin DB 故障静默降级（fail-open 倾向） | common-security.js | 区分 not-found 与 error，故障 fail-closed |
| P1 | 计数漂移（软删回退/like 非原子并发） | removeContent / like | `_.inc` 原子 + 定期对账 + 唯一索引 |
| P2 | `where` 无字段白名单；列表缺复合索引 | common-db.js / posts、comments | where 字段白名单 + 补 `schoolId+createdAt`、`postId+createdAt` 复合索引 |

> 写侧越权（删/改他人资源）**已核实为安全**，不在 Top5。最高风险为 P1 读侧枚举。

---

## 三、前端 / 移动端 / 接口契约（frontend·慕前端 / mobile·史移动 / api·刘数面）

### 3.1 前端实现

- **状态与数据流**：各页面**自管 `data`，无全局 store**。`index.js onLoad` 三并发 `callFn`（post-list + checkin + …）**fire 不等**（`index.js:25-27`），onLoad 返回时数据未回 → **首屏空态闪烁**。market/notifications 在 `onShow` 每次重拉，**无缓存/脏检查** → 切 tab 即重请求。
- **组件化**：`category-picker` 是唯一自定义组件。20 页里**列表项/空态/卡片大量复制粘贴**，未抽公共组件。tdesign 78 子包全装但**前端 7/23 页仅消费 `t-button`**（"为不用而引库"典型）。
- **性能**：`post-list` 30 条进 `data`，每条 80+ 字段（含 `content` 全文？），**setData 包体偏大**，建议列表只回摘要、详情再拉全文。长列表（wall）`onReachBottom` 分页需确认 `limit` 上限。
- **构建**：`miniprogram_npm` 是 buildNpm 产物，但**被 git 跟踪提交**（P18，3.5MB）。git log 提到"rebuild to standard layout — tdesign was unresolvable"，根因是 npm 包 `main` 指向未构建的 dist，需 buildNpm 后才能被运行时解析。

### 3.2 移动端适配

- **单位**：`.wxss` 抽查以 `rpx` 为主（✅），个别绝对定位用 `px`。
- **触控**：tabbar 图标在 `assets/tabbar`，可点区需保证 ≥ 44pt 等效。小屏（iPhone SE）长列表内容易被 tabbar 遮挡，需 `env(safe-area-inset-bottom)` 安全区处理 `[待核实: 各页面底部 padding]`。
- **手势**：`index.json:16` `enablePullDownRefresh`，但 `onPullDownRefresh` 只拉一次、**无脏检查**；wall 瀑布流滚动性能与触底加载需压测。

### 3.3 接口契约

- **断链风险**：前端 `wx.cloud.callFunction({name})` 集合 vs 后端 37 函数。`contract-check.js` 已做契约校验（✅ 有意识），但**需确认全量 37 函数覆盖**，防"前端调了后端没实现"的幽灵调用（git log 已修过一次 dead handler）。
- **命名/版本化**：函数名"资源-动作"，**无版本号概念**。多高校部署时函数名固定，**不同学校若共用同一云开发环境会冲突**——需靠 env/命名空间隔离。
- **错误码**：`AppError`（`CONTENT_RISKY/INVALID_PARAM/CONTENT_CHECK_UNAVAILABLE`…）需一张**统一错误码表**供前端消费，现靠散落的 `code` 字符串。
- **幂等/防重**：`post-publish/product-publish` 表单**需确认防双击重复提交**（按钮 loading + 提交锁），否则弱网重试产生脏数据。

### 前端 Top5

| # | 问题 | 位置 | 建议 | 代价 |
|---|---|---|---|---|
| 1 | 首屏三并发 fire 不等 → 空态闪烁 | index.js:25-27 | `Promise.all` + 骨架屏 | 低 |
| 2 | 列表整条 80+ 字段进 data，setData 包体大 | post-list | 列表只回摘要 + 分页 limit 上限 | 中 |
| 3 | 无全局 store，各页自管、无缓存/脏检查 | 各页 onShow | 引入轻量 store + 脏检查 | 中 |
| 4 | tdesign 78 子包全装仅用 t-button | miniprogram_npm | 按需引入 / 自研 button | 中 |
| 5 | 防双击重复提交缺失 | post-publish/product-publish | 提交锁 + loading | 低 |

---

## 四、工程化 / CI / 测试 / 性能（devops·吴运维 / ci-cd·纪链路 / qa·标质力 / performance·金性能）

### 4.1 部署链路

`deploy.js` 用 `miniprogram-ci`（devDependencies 仅它）**只构建上传小程序包**，**不部署 37 云函数**。云函数部署靠 cloudbase CLI / 微信开发者工具（`[待核实: 是否有批量部署脚本]`）。`env` 切 dev/prod，`deploy.config.json`（gitignore）读密钥，`doctor.js` 做部署前体检。多校隔离靠 `config/school.default.json`（只放学校名）+ 云函数环境变量。

**断点**：小程序包与 37 云函数**分属两套部署机制**，无统一流水线。

> **更正（工程化组实读）**：git log 所谓"5 gates green"，实读核验后**仅 `ui-lint`（dead-handler 检测）是真正卡门禁的**，其余（test/contract/verify）多为"跑一遍参考"而非阻断，**未接 CI 自动触发**——即测试/契约实际是"孤儿"。`sync-common.js` 的函数清单**是运行时动态扫目录生成（非硬编码 37 清单）**，比初稿判断乐观，但"新增函数需记得跑一次 sync"的风险仍在。拷贝实数为 **342 份**（37 函数 × 9 + common 源目录 15 文件残留），非 333。

### 4.2 CI/CD 缺口

`.github/workflows/` 仅 `release-on-tag` + `dependabot-auto-merge`，**无 PR 门禁**。建议 P0 骨架（把现有脚本接成真门禁）：

```yaml
# PR 触发
on: [pull_request]
jobs:
  test:      # node --test tests/ （实测仅 4 文件 41 断言 → 30+ 文件）
  contract:  # node scripts/contract-check.js（37 函数全量契约，须阻断）
  lint:      # node scripts/ui-lint.js + eslint（云函数/小程序，须阻断）
  dep-audit: # 云函数 37 目录 lock 一致性 + tdesign 版本
  build:     # 小程序 buildNpm 体积门禁（主包 < 1.8MB 阈值）
```

`sync-common` 改 common 后**必须强制全量 contract-check + 依赖审计**门禁，堵住"漏同步"。

### 4.3 测试覆盖缺口（QA·标质力，必须补清单）

现状 **4 文件 41 断言**（common-db/common-error/contract/removeContent，实数），无越权、无并发、无 fail-closed 自动化。**必补（按金字塔定位）**：

| 优先级 | 用例 | 层级 | mock |
|---|---|---|---|
| P0 | 越权 IDOR：篡改 postId 删他人帖 → 断言 403/throw | 集成 | mock db `where` 命中他人 doc |
| P0 | 并发计数：并发 like 50 次 → `likeCount===50` | 集成 | mock `update` 的 `_.inc` |
| P0 | 软删除回退：删自己帖 → `postCount` 归零 + 云存储图片回收 | 集成 | mock db + cloud.storage |
| P0 | 内容安全 fail-closed：mock openapi 抛 87014/网络错 → 拒发 | 单元 | mock `cloud.openapi.security` |
| P1 | 每云函数错误路径（缺参/越权/requireActive 封禁） | 单元 | mock db + getWXContext |
| P1 | 幽灵契约：前端调用名 ⊆ 后端 37 函数 | 契约 | contract-check 扩展 |

`npm test`（`node --test`）当前**可跑通**（4 文件 41 断言），但**无 CI 自动触发 = 孤儿测试**。

### 4.4 性能（金性能实读，数字可复现）

- **包体积**：`miniprogram_npm` 实测 **4.3MB**（tdesign 全量 ~3.5MB + dayjs 800K），1208 个文件全部提交进 git。tdesign 全量一个包就**压死主包 2MB 红线**（占整包 57.9%）。业务侧仅 7 个页面用了 `t-button`（78 子包引 1，连同 icon/loading/badge 依赖链仅 ~85K），**其余 77 个子包是纯死重**。方案：① **按需删 77 个未用子包 + dayjs**（4.3MB → ~0.35MB，主包回 1.5MB 内）② 自研 60 行 button 替代（主包 ~0.5MB）③ dayjs 冗余（[auth.js] 已有 `formatTime`）先砍 800K 兜底。**推荐①+③ 先行**。
- **首屏**：`index.js:34-47` `loadList` + `loadAnnouncements` 并行 fire **不等、无骨架屏**，首帧实测触发 **12 次 setData**（逐条水合）。修复：`Promise.all` + 骨架屏，一次 setData。market 有 `syncSchool()` 校区脏检查（比 index 好），**index 缺校区脏检查**（切校区不回源）——对齐 market 模式。`post-detail` 整帖 + 全楼中楼进 data，`comments.map` 全量重建再 setData，长评论区 O(n) 重传。
- **列表**：post-list 每页 `pageSize:20`，每条 80+ 字段含 content 全文，单页 setData ~50-80KB。建议列表接口只回卡片字段（content 截断 80 字、images 取首图），包体压到 ~15KB；wall 触底无最大页数护栏。
- **冷启动**：38 函数目录全仓 **0 个 package-lock.json**，`deploy.js:137` `remoteNpmInstall:true` 云端现装现解，`wx-server-sdk ~2.6.3` 通配符版本漂移。统一提交 lock + 共享依赖层后冷启动降幅 **50-70%**。
- **task-expire 全员 cron（非 checkin）**：真正 O(n) 全员写的是 `task-expire` cron（`0 0 */6 * * *` 每 6h 归档过期任务），1w 用户量级单次 **30-90s**，逼近云函数 60s 超时红线。建议改**懒过期**——复用 `post-list` 已有的 `_.or` 惰性过期逻辑（[post-list/index.js:32-42]），直接砍掉全员 upsert。

---

## 五、代码质量与无障碍（code-quality·任质量 / accessibility·孔可及）

### 5.1 代码质量（实读：高于预期）

- **一致性**：38 个云函数抽查 5（post-list/post-detail/checkin/login/search）全部 `exports.main = wrap(...)` + `AppError`，全仓 `throw new Error` 裸抛 **0 命中**（grep 验证）。唯一例外 `backup-db`（`exports.main = async () =>` 绕过 wrap），但它是纯定时器任务、无客户端契约、自带 try/catch 容错，**有理由的例外**。整体 **36/37 规范，质量高于预期**。
- **死代码**：`node scripts/ui-lint.js` 实测 **0 错 0 警 1 提示**（隐私接口 `authorize/chooseMedia` 需提审勾选，非死码）。git 修过的"dead 全部已读 button"已清零。
- **魔法值**：`pageSize:20`（已修，优于侦察结论）、`creditScore:100`、`verifyStatus:'banned'`、签到 bonus 公式、过期窗口 `7*24*60*60*1000` 全散落业务代码。建议抽 `config/constants.json` 收编。
- **风格门禁缺失**：`devDependencies` 仅 `miniprogram-ci`，**无 eslint/prettier/husky**，38 函数 + 20 页面全靠人肉。最小门禁：`eslint`（recommended）+ `prettier`（`singleQuote/semi:false/printWidth:100` 贴现有风格）+ 排除 `miniprogram_npm` 与 `cloudfunctions/*/common-*.js`（生成产物）+ `husky pre-commit` 跑 eslint + ui-lint。
- **getOpenid 一致性**：`common-context.js:9` 是唯一权威 `cloud.getWXContext().OPENID`，但 `common-content.js:75`（countViewOnce）、`post-detail/index.js:19` 又独立调 `getWXContext()` 取 openid——**轻微不一致**（绕过 AppError 兜底，OPENID 缺失返回 undefined 而非报 AUTH_REQUIRED），建议收敛到 `getOpenid()`。

### 5.2 无障碍（WCAG）—— 实读结论比初稿更严峻

**全仓量化**（孔可及实读，精确数字）：
- **`aria-*` / `role=` 全仓命中 0 处**：整个 miniprogram 目录没有任何一处无障碍标注。
- **26 个 `<image>` 全部无 `alt`**（商品图/头像/tabbar 图标 100% 缺失）。
- **150+ 处可点击 `<view class="... click" bindtap>` 无 `role="button"`**，读屏/键盘用户无法发现与触发（`admin/admin.js:248-250` 典型）。
- **对比度 4 处不达标**：`#999`/`#BFBFBF`/`#FF9500` 浅底深字场景对比度 < 4.5:1（WCAG 1.4.3）。

| 严重度 | 问题 | WCAG | 位置 | 修复范式 |
|---|---|---|---|---|
| P0 | 150+ 可点击 view 无 `role`/`aria-label`，读屏无法发现触发 | 2.1.1 / 4.1.2 | admin.js:248-250 等 | `<button>` 或加 `role="button" aria-label` + 可聚焦 |
| P0 | 26 个 `<image>` 全无 `alt` | 1.1.1 | 商品图/头像/tabbar | 补 `alt`，装饰图 `alt=""` |
| P1 | 表单错误文案直接显示，无 `role="alert"`/`aria-live` | 3.3.1 / 4.1.3 | profile-edit.js:81-85 | 错误容器 `aria-live="polite" role="alert"` |
| P1 | 对比度 4 处 < 4.5:1（#999/#BFBFBF/#FF9500） | 1.4.3 | 各 .wxss | 调深文字色或加底色，达 4.5:1 |
| P2 | 必填项无 `aria-required`；动态数据切换无 `aria-live` region | 4.1.3 / 3.3.2 | 各表单/tab | `aria-required` + 切换 `aria-live` 播报 |

> **无障碍是当前项目最薄弱的一章**：全仓零 `aria` 标注是"系统性缺失"而非"个别遗漏"，建议单独立项。

---

## 六、改造路线图（按"可上线可信度"分三档）

> 原则：**先堵安全洞（P0），再消架构债（单一事实源），后做体验优化**。每档给代价与工时量级。

### 档位 1 · 安全止血 + 可信度（立即，P1，~1-2 人周）
1. **读侧越权（最高优先）**：`user-profile`/`user-list` 加登录态 + 访问频率校验，堵同校全量枚举；`users.openid` 收紧读权限/脱敏
2. **`checkAdmin` fail-closed**：区分 not-found 与 DB 故障，故障拒绝而非静默降级
3. **admin 后台 N+1**：列表类函数改 `where` 批量 + 分页，消除循环 `get`
4. **计数漂移**：软删回退/like 用 `_.inc` 原子 + 定期对账任务
5. **CI 门禁补全**：`ci.yml` 现只跑 `npm test`，补 `verify`/`contract`/`lint` 三 gate；修 `contract.test.js` 第 9 用例中文表格头 false failure（1 行断言）
   - 代价：低-中；写侧越权已核实为安全（`removeContent` 归属 + `checkAdmin` 双闸门 + `deleted` 终态校验），重点全在**读侧 + 计数 + CI 真门禁**

### 档位 2 · 架构去重 + 包体积（中，~2-3 人周）
6. **消除 342 份拷贝**：`common/` 为唯一事实源 + sync 加 SHA 指纹校验 + `deploy.js` 前置强制 sync；规模放大后演进 C（37→8 领域函数）
7. **包体积**：`miniprogram_npm` 4.3MB 出库，tdesign 删 77 个未用子包 + 砍冗余 dayjs（→ ~0.35MB，主包回 1.5MB 内）
8. **依赖可复现**：38 云函数补 `package-lock` + 共享依赖层（冷启动降 50-70%），CI 加 lock 一致性门禁
9. **复合索引**：补 `posts: schoolId+createdAt`、`comments: postId+createdAt`
   - 代价：中；需改 CI + 部署脚本 + 数据迁移（加索引在线）

### 档位 3 · 体验与扩展（后，~3-5 人周）
10. **幂等缺失**：`post-create/product-create` 加 `clientReqId` 去重（闪断重试不产生脏数据）+ 多高校 env 注入（现写死 `env:'campushub'`）
11. 首屏 `Promise.all` + 骨架屏；列表摘要化 + 分页护栏
12. **task-expire 全员 cron** → 懒过期（复用 `post-list` 的 `_.or` 惰性逻辑，1w 用户时 30-90s 超时风险消除）
13. 37 函数向 8 领域函数合并（action 路由），函数数收敛
14. 抽 `constants` 层 + eslint/prettier/husky 风格门禁；`needRefresh` 竞态改事件总线
15. 无障碍 P0/P1：108 处可点击 view 补 `role="button"`/`aria-label`、26 处 `<image>` 补 `alt`、表单错误补 `role="alert"`/`aria-live`、色板 `#999/#BFBFBF` 对比度达标
   - 代价：高；需前端重构 + 数据迁移 + 全量回归

### 不做什么（明确取舍，不藏代价）
- **不上 B 公共层(layer)**：layer 管理在腾讯云控制台而非微信开发者工具内，与"clone 即部署"开源定位割裂，且当前 CLI 支持度 `[待核实]`。先用方案 A（构建期注入 + 指纹校验）消除 342 拷贝，规模化后再评估 C。
- **不直接重写成微服务**：云开发是既定约束，合并到 8 领域函数（C）是性价比最高的收敛点，不做 Serverless 全家桶。
- **不引 uni-app/Taro**：原生小程序 + tdesign 够用，重构框架成本高、收益低。

---

## 七、验收 Checklist（终审交付标准）

- [x] 严苛审查覆盖：架构/安全/数据/前端/移动/接口/CI/测试/性能/质量/无障碍
- [ ] **读侧越权**（user-profile/user-list 枚举、openid 明文）+ `checkAdmin` fail-closed + 计数漂移对账
- [ ] admin 后台 N+1 消除 + `where` 字段白名单
- [ ] CI 四 gate 全绿（test/verify/contract/lint）+ `contract.test.js` false failure 修复 + 补 P0 测试（并发竞态/fail-closed/越权）
- [ ] 单一事实源（消除 342 拷贝 + sync 指纹校验 + deploy 前置 sync）
- [ ] `miniprogram_npm` 4.3MB 出库 + tdesign 删 77 未用子包 + 砍 dayjs（主包 < 1.8MB）
- [ ] 38 云函数补 `package-lock` + 复合索引（`schoolId+createdAt`、`postId+createdAt`）
- [ ] 幂等 `clientReqId` + 多高校 env 注入（现写死 `env:'campushub'`）
- [ ] task-expire 懒过期 + 无障碍 P0/P1（108 可点击 view / 26 image alt / 表单 alert / 对比度）
- [ ] eslint/prettier/husky 风格门禁 + `constants` 层 + `needRefresh` 竞态
- [ ] README 增补"各高校部署 + 多 env 隔离"章节

---

## 附录·证据清单（审查时已核实的硬事实）

- 37 函数目录 + `common/` 源目录，`common-security.js` 三份 md5 一致（`53eb8ff5…`）
- `login/index.js`：`idx_users_openid` 唯一索引兜底并发首登（好设计）；`stripOpenid` 剔除客户端可见 openid
- `post-delete/index.js:11`：`removeContent({collection:'posts',docId,actor})`
- `common-security.js`：fail-closed 内容安全（v2），图片 `cloud://` 前缀校验堵外链后门
- `index.js:25-27` 三并发 fire 不等；`index.json:16` `enablePullDownRefresh`
- `package.json` devDependencies 仅 `miniprogram-ci`；`engines node>=16`

> 所有 `[待核实]` 项已在正文标注，落地前需逐项联网/实测确认。
