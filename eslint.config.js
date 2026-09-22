// ESLint flat config（ESLint 8.57+ / 9+ 通用）
// 说明：
//   - 小程序全局（wx/App/Page/Component/getApp/cloud）声明为 readonly，避免 no-undef 误报。
//   - cloudfunctions/*/common/* 是「common kernel 同步副本」（由 scripts/sync-common.js 维护），
//     与 miniprogram_npm、node_modules 一并忽略——lint 只覆盖源文件，不碰同步产物。
//   - no-unused-vars 允许 _ 前缀（未用形参/变量常见于事件回调占位）。
const globals = {
  wx: 'readonly',
  App: 'readonly',
  Page: 'readonly',
  Component: 'readonly',
  Behavior: 'readonly',
  getApp: 'readonly',
  getOpenerEventChannel: 'readonly',
  cloud: 'readonly',
  cloudFunction: 'readonly',
  console: 'readonly',
  Buffer: 'readonly'
}

const baseRules = {
  'no-undef': 'off', // 小程序全局由上面的 globals 显式提供，无需依赖环境预设
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
}

module.exports = [
  {
    ignores: [
      'miniprogram_npm/**',
      'node_modules/**',
      '.husky/**',
      'cloudfunctions/*/common/**',
      'scripts/coverage/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals
    },
    rules: baseRules
  }
]
