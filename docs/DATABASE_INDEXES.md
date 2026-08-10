# 数据库索引清单（已合并）

> ⚠️ 本文档已合并进 **[`docs/INDEXES.md`](./INDEXES.md)**。

`docs/INDEXES.md` 现在是该项目的**唯一权威索引指南**，并且与代码中的单一事实来源
`cloudfunctions/common/common-indexes.js` 对齐；`init-db` 部署时会自动比对并回显缺失索引
（`missingIndexes`），不再需要手抄这份清单。

请直接查阅 **[`docs/INDEXES.md`](./INDEXES.md)** 获取：

- 为什么索引只能手工在控制台建（微信云开发 `wx-server-sdk` 无 `createIndex` API）
- 控制台创建步骤
- 完整索引清单（被 `common-indexes.js` 驱动）
