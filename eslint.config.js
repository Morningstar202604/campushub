// ESLint flat config（ESLint 8.57+ / 9+ 通用）
// 说明：
//   - 小程序全局（wx/App/Page/Component/getApp/cloud）声明为 readonly，避免 no-undef 误报。
//   - dist/ 是 scripts/build-functions.js 的内联产物（生成物），
//     与 node_modules 一并忽略——lint 只覆盖源文件，不碰构建产物。
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
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]
}

module.exports = [
  {
    ignores: [
      'miniprogram_npm/**',
      'node_modules/**',
      '.husky/**',
      'dist/**',
      // Android 壳工程：build/ 是 Gradle 产物，assets/www 是 H5 构建拷贝，都不是源文件
      'android/**',
      'scripts/coverage/**',
      'uni-app/**'
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
