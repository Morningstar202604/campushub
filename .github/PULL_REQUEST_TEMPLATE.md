<!-- 提交前请先阅读 CONTRIBUTING.md -->

## 这个 PR 做了什么？

<!-- 简述改动；若是修复，说明修复了什么问题 -->

## 关联 Issue

<!-- 例如：Closes #123 -->

## 改动类型

- [ ] Bug 修复 (fix)
- [ ] 新功能 (feat)
- [ ] 文档 (docs)
- [ ] 重构 (refactor)
- [ ] 其他（请说明）

## 检查清单

- [ ] 已运行 `npm run sync:common`（若改动涉及 `cloudfunctions/common/`）
- [ ] 新增云函数均含 `package.json`
- [ ] 新增索引已在 `cloudfunctions/common/common-indexes.js` 登记并在 `docs/INDEXES.md` 说明
- [ ] 未在 `cloudfunctions/*/` 内直接修改 `common-*.js` 副本
- [ ] 无密钥 / token 提交进仓库

## 测试方式

<!-- 在微信开发者工具中如何验证本改动 -->
