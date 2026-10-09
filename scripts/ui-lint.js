#!/usr/bin/env node
/**
 * CampusHub UI 层 lint（ui-lint）
 *
 * 前端已迁移至 uni-app（Vue 3 SFC），原 WXML/WXSS 检查不再适用。
 * 本脚本保留为占位入口，执行 `npm run lint` 时输出迁移提示并正常退出。
 *
 * uni-app 端的代码质量由以下机制保障：
 *   - vue-tsc 类型检查（uni-app 端 `npm run type-check`）
 *   - ESLint（eslint.config.js：cloudfunctions/ + scripts/ 全覆盖）
 *   - 4 个 Python 验证脚本：verify_pages.py / verify_contracts.py / verify_edit.py / verify_gaps.py
 *
 * 用法：node scripts/ui-lint.js
 * 退出码：始终 0（迁移后无操作）。
 */
console.log('CampusHub UI 层 lint')
console.log('====================')
console.log('✓ [info] 前端已迁移至 uni-app/（Vue 3 SFC），WXML/WXSS 检查不再适用。')
console.log('        uni-app 端代码质量由 vue-tsc + ESLint + uni-app/scripts/*.py 保障。')
console.log('        参见 uni-app/README.md。')
process.exit(0)
