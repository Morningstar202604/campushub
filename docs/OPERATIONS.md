# CampusHub 运营手册（OPERATIONS）

> 面向管理员/校园大使的日常运营 SOP。技术部署见 DEPLOY.md，安全规范见 SECURITY.md。

---

## 1. 数据备份（已自动化 + 手动兜底）

### 1.1 自动备份（推荐，已内置）

`backup-db` 云函数已配置**每天 03:00 定时触发**，自动把核心业务集合快照写入
`backups` 集合（JSON 分片），并清理超过保留期的旧备份：

- 保留天数：环境变量 `BACKUP_RETENTION_DAYS`（默认 7 天）
- 备份集合：users / posts / products / comments / likes / collects /
  guides / guide_categories / categories / reports / feedbacks /
  follows / checkins / notifications / verify_requests
- **部署时必须**：上传 `backup-db` 函数 + 单独上传其**定时触发器**
  （云开发控制台 → 云函数 → backup-db → 触发器）

**手动恢复步骤**（数据误删时）：
1. 云开发控制台 → 数据库 → `backups` 集合，按 `date` 筛选目标日期的快照
2. 读取对应分片文档的 `records` 字段（JSON 数组）
3. 手动写入原集合（或用脚本批量 `add`）

### 1.2 手动兜底备份（每周日，约 5 分钟）

自动备份之外，建议每周日手动导出一次到本地网盘（双保险）：
云开发控制台 → 数据库 → 依次导出 JSON：
`users`、`posts`、`products`、`comments`、`likes`、`collects`、
`categories`、`guides`、`guide_categories`、`follows`、`checkins`、
`notifications`、`reports`、`feedbacks`

> ⚠️ 免费体验环境在小程序**发布上线后第 15 天到期**，到期未转付费会清空数据。
> 上线当天请在日历设置「上线+14天」提醒，及时购买基础套餐（19.9 元/月）。

## 2. 每日值班清单（管理员）

| 时间 | 动作 |
|------|------|
| 早晚各一次 | 管理后台 → 举报审核：处理新举报 |
| 早晚各一次 | 巡检首页信息流：发现违规/引流/广告帖直接删除并视情节封禁 |
| 发现即办 | 用户反馈（管理后台 → 反馈列表）：回复或标记处理结果 |

封禁尺度参考：色情/政治/诈骗/外挂引流 → 永久封禁；吵架刷屏 → 首次警告（私信），再犯封 7 天。

## 3. 内容安全应急流程

项目已内置 fail-closed 内容审核（msgSecCheck/imgSecCheck），但仍有漏网场景：

1. **发现违规内容**：立即删除（管理后台或内容删除接口），必要时封禁作者
2. **涉政/涉恐/诈骗类**：截图留证 → 删除 → 封禁 → 向学校相关部门报备
3. **审核服务故障**（用户反馈"发不了帖"）：云函数日志搜 `[内容安全]`；
   若为平台 API 故障，等待恢复期间可在群内公告，**严禁关闭 fail-closed 放行内容**
4. **被监管部门问询**：按 SECURITY.md 的数据留存条款配合提供 logs/用户记录

## 4. 冷启动与增长（开学季 SOP）

- **上线前一周**：灌 50 篇种子攻略（新生指南/选课攻略/食堂测评/周边地图）
- **开学周**：新生群投放 + 宿舍海报（二维码）+ 「学长学姐问答周」活动
- **失物招领地推**：联系校保卫处/宿管，拾获物品统一挂平台
- **校园大使**：招募 5~10 人，给管理员权限 + 简历背书，负责各自院系拉新

北极星指标看板（每周记录）：DAU / 日发帖数 / 7 日留存 / 二手成交流水笔数。

## 5. 成本监控（每月 1 日，10 分钟）

1. 云开发控制台 → 套餐用量：查看本月资源点消耗结构
2. 若数据库调用占比 >70%：检查是否有人高频爬列表（可用 rateLimit 收紧）
3. 若 CDN 流量异常：检查是否有用户上传超大图（utils/image.js 压缩链路是否生效）
4. 记录当月账单到 `docs/成本台账.md`（自建），对照 `docs/archive/EXPERT_REVIEW_AND_ROADMAP_v0.6.0.md` §2.5 估算表

## 5.5 监控与告警

### 5.5.1 SLO 与错误预算

单校部署规模下，按「用户可感知」定义 3 条 SLO（其余指标不设 SLO，避免无人维护的空指标）：

| SLO | SLI 定义 | 目标 | 测量方式 | 违反时的动作 |
|---|---|---|---|---|
| 信息流可用性 | `post-list` 非 5xx 响应 / 总请求 | 99.5% / 30 天 | 云开发控制台函数监控（错误率） | 若 <99.5%，冻结发版，先查错误日志 |
| 发布成功率 | `post-create` 的成功 / 总请求（排除用户参数错误 4xx） | 98% / 7 天 | 同上 + `admin_logs` 无异常 | 检查审核服务配额与 fail-closed 是否误杀 |
| 备份新鲜度 | 最近一次 `backup-db` 成功距今 | ≤ 26 小时 | `backups` 集合按 date 查最新 | 立即手动触发 `backup-db`，并重传触发器 |

**错误预算**：30 天窗口内允许 0.5% 不可用 ≈ 3.6 小时。预算耗尽后：只允许修 bug，不允许发新功能，直到下一个窗口。

### 5.5.2 告警清单（每条都必须有处置动作）

在云开发控制台 → 告警配置里逐条建立：

| 告警 | 阈值 | 处置（runbook） |
|---|---|---|
| 云函数错误率 | 任一函数 5 分钟内错误率 >5% | 看该函数日志首条 stack；若是 `CONTENT_CHECK_UNAVAILABLE` 说明审核配额耗尽，按 §5.7 处理 |
| 云函数超时 | 任一函数 P99 > 8s | 查是否 N+1（`task-expire` 清理、`admin list-reports` 批量查询已做并发化） |
| 数据库读次数 | 日增 >50% 且绝对值 >10 万 | 查 `post-list` / `search` 是否被脚本刷；用 `rateLimit` 收紧 |
| 存储流量 | 日增 >2 GB | 查是否有超大图上传绕过前端压缩（`utils/api.ts` uploadImage） |
| 备份缺失 | `backups` 无当日记录 | 手动触发 `backup-db`，检查触发器是否丢失（部署后触发器需单独上传） |
| 定时任务未执行 | `task-expire` 无 6 小时记录 | 同上，触发器问题 |

> 云开发控制台告警通过「消息订阅」推送，需管理员在小程序内订阅一次。未订阅 = 收不到，这是该平台限制，无法绕过。

### 5.5.2b 职责与升级路径（单校部署的最小可执行版本）

开源项目不设专职值守，但**必须有一个写明名字的人**，否则告警无人处置：

| 角色 | 职责 | 由谁担任 |
|---|---|---|
| 部署负责人（Owner） | 云环境 / 域名 / 备案 / 付费账号的唯一持有人；SLO 违反时的决策人 | 部署方指定 1 人（在 `docs/DEPLOY_VERIFICATION.md` 顶部填写姓名与联系方式） |
| 内容审核值班（Moderator） | §2 每日值班清单、举报处置、封禁 | 管理员账号持有人（可多人轮值，`ADMIN_OPENIDS` 里逐个登记） |
| 技术兜底（Maintainer） | 代码缺陷 / 安全问题的修复与发版 | 仓库维护者（见 `package.json` 的 `author` / `repository`） |

升级路径（告警触发后按序执行，每级 30 分钟无响应即上报下一级）：

1. Moderator 判断是否为内容问题 → 是则按 §3 处理，结束
2. 否则转 Maintainer，在 GitHub Issue 记录现象、时间、函数名与首条错误日志
3. SLO 违反或数据风险（备份缺失 / 误删）→ Owner 决策：冻结发版、回滚版本或进入恢复演练
4. 涉及个人信息泄露 → Owner + Maintainer 同时介入，按 `SECURITY.md` 的 Incident response 表格执行，并在 72 小时内完成影响面评估

> 只有 1 人部署的小规模场景可以 Owner = Moderator = Maintainer，但**不允许为空**。部署前把这张表填进 `docs/DEPLOY_VERIFICATION.md`。

### 5.5.3 例行巡检

1. **每周**查看 `post-list` / `search` / `init-db` 的调用量与错误率
2. **每月 1 日**按下方「成本监控」核对资源点用量
3. `backup-db` 每天应有一次成功执行记录；若某天无记录，说明触发器未生效

### 5.5.4 恢复演练（每季度一次）

`backup-db` 只负责写，恢复靠 `scripts/restore-backup.js`。**未演练过的备份等于没有备份**：

```bash
# 1) 空跑，确认备份覆盖了哪些集合、各多少条
WX_APPID=... WX_SECRET=... CLOUD_ENV=...   node scripts/restore-backup.js --date 2026-10-21 --dry-run

# 2) 在测试环境真恢复（默认跳过已存在 _id，不会覆盖线上数据）
WX_APPID=... WX_SECRET=... CLOUD_ENV=...   node scripts/restore-backup.js --date 2026-10-21 --yes

# 3) 只恢复单个集合（误删某类数据时）
node scripts/restore-backup.js --date 2026-10-21 --collection posts --yes
```

验收标准：恢复后 `posts` / `users` 的条数与备份分片的 `recordCount` 之和一致。
若脚本提示「备份本身被截断」，说明该集合超过 `MAX_PARTS_PER_COLLECTION`（2 万条），
需调大 `backup-db` 的分片上限，否则该集合的备份不可用于完整恢复。

## 5.6 搜索性能与降级（重要）

`search` 云函数使用正则全表扫描（微信云开发无全文索引），数据量增长后：
- 超过 ~1 万条内容时，搜索延迟与资源点消耗会显著上升
- 服务端已加**每用户 10 秒 3 次**限频兜底，并写入 `search_queries` 供热词聚合
- 若搜索成本失控，可在 `search` 函数临时关闭搜索（返回空结果）或接入外部检索（如腾讯云 ES）

## 6. 版本发布流程

```
改动 → npm run doctor → 微信开发者工具真机预览全流程测试
     → 上传代码（版本号按 CHANGELOG）→ 提审 → 通过后发布
     → 若改了 cloudfunctions/**：npm run deploy 或 CI 自动部署
     → 发布后在 CHANGELOG.md 补记日期
```

回滚：小程序后台版本管理可回退上一审核通过版本；云函数用 git checkout 对应 tag 后 `npm run deploy -- --only 函数名`。

## 7. 依赖版本基线（wx-server-sdk 锁定）

云函数端唯一的外部依赖是 `wx-server-sdk`。为避免各函数在云端 `remoteNpmInstall` 时按各自
range 现装导致版本漂移，项目把版本**锁定到单一基准**：

- **基准文件**：`cloudfunctions/common/package.json`（精确版本 `2.6.3`，无 `~`/`^`）
  + `cloudfunctions/common/package-lock.json`（唯一 lock 基准，由
  `npm install --package-lock-only` 生成）。
- **约定**：所有云函数的 `wx-server-sdk` 以 common lock 锁定的 `2.6.3` 为基线。
  **升级时只改 `cloudfunctions/common/package.json` 一处**，再重新生成 lock，
  然后 `npm run build:functions` 重建产物 + 各函数 `config.json` 对齐 openapi 声明。
- **自检**：`npm run doctor` 的第 7 项会核对各函数 `package.json` 的 `wx-server-sdk`
  与 common lock 基线是否一致，不一致会告警。
- **不逐函数建 lock 的原因**：38 个函数各建一份 `package-lock.json` 会引入 38 个冗余
  lock，且云函数目录本不该带 `node_modules` 语义（依赖由云端 `remoteNpmInstall` 现装）。
  用「common 单 lock 作基准 + doctor 一致性告警」是更轻量的兜底。

> ⚠️ 各函数 `package.json` 仍写 `~2.6.3`（保留 range 以允许 patch/minor 自动升级）。
> 若要求云端安装**强一致**到精确版本，把各函数的 `~2.6.3` 改成与基线相同的 `2.6.3`
> 即可（doctor 会按声明匹配校验；range 与基线主版本一致时不告警漂移）。
