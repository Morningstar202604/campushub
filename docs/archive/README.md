# 历史文档归档 / Archived Documents

> 本目录存放**已过期但保留可追溯性**的报告与方案。它们描述的是历史版本（v0.6.0 / v0.8.1 / 原生小程序时代），
> **不代表当前实现**，不要按这里的结论或步骤操作。当前事实以仓库根目录的 [`CHANGELOG.md`](../../CHANGELOG.md)、
> [`docs/AUDIT_REPORT_2026-10-22.md`](../AUDIT_REPORT_2026-10-22.md)、[`docs/DEPLOY.md`](../DEPLOY.md) 为准。

| 文件 | 基线版本 | 归档原因 |
|---|---|---|
| `AUDIT_REPORT_v0.8.1.md` | v0.8.1（原生小程序 + 37 函数目录） | 其中的 P1 问题已在 v0.9.2–v0.9.4 全部修复；架构已变为 uni-app + 网关注入 |
| `CHANGES_2026-09-21.md` | v0.8.1 | 当时的改造审阅清单，含已删除的 `miniprogram/` 目录路径 |
| `OPTIMIZATION_PLAN_v0.8.1.md` | v0.8.1 | 优化方案已落地，页面数/函数数口径全部过期 |
| `architect-and-debt-review_v0.8.1.md` | v0.8.1 | 技术债盘点已随网关收敛与内核内联解决 |
| `EXPERT_REVIEW_AND_ROADMAP_v0.6.0.md` | v0.6.0 | 早期路线图，成本估算表仍可参考（`docs/OPERATIONS.md` 有引用） |
| `NPM_TRIM_miniprogram.md` | 原生小程序 | `miniprogram_npm` 瘦身方案，uni-app 迁移后不再适用 |
| `ANDROID_MIGRATION.md` | 迁移决策期 | 迁移已完成，决策记录留档 |
| `campushub-report-v0.8.1.html` | v0.8.1 | 离线单文件可视化审计报告（原 `wb/web/_analyze/`，工作区清理前归档） |
| `worklog-2026-10-19_20.md` | v0.8.1→v0.9.x | 旧工作区的两日工作日志（原 `.workbuddy/memory/`） |

> 归档不是删除：`git log --follow <path>` 仍可追溯每一次修改。
