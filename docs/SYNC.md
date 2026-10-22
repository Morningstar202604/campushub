# 共享内核的交付方式：构建期内联

> 适用版本：v0.9.3+。此前用 `npm run sync:common` 把内核复制进每个函数目录，该机制已废弃。

## 为什么换掉"复制到 37 个目录"

云开发不支持跨函数共享代码，所以内核（`cloudfunctions/common/` 的 11 个模块）必须以某种形式出现在每个函数里。旧做法是 `sync-common.js` 把 9 个文件复制进 37 个函数目录——**333 份副本**。

问题不在"要不要复制"，而在**运行时加载的是副本**：`common-bundle.js` 里是 `require('./common-rate')`，Node 解析到的是函数目录里的那一份。于是只要有人改了 `cloudfunctions/common/` 而漏跑一次同步，线上跑的就是旧内核。

v0.9.3 正是这样踩中的：内核源码里的限频器改成了缺参即抛错（fail-closed），但 37 份副本仍是上一版的 `if (!collection) return`（fail-open）。"单一数据源、零漂移"这句宣称，在当时那句纪律没被任何**在当前平台上真正执行**的门禁保护（GitHub Actions 在 GitCode 上不会触发）。

## 现在的机制

```text
cloudfunctions/common/*.js      ← 内核唯一源码（只在这里改）
cloudfunctions/<fn>/index.js    ← 业务代码，require('./common-bundle')
        │
        │  npm run build:functions   （esbuild，构建期内联）
        ▼
dist/cloudfunctions/<fn>/index.js    ← 单文件产物，内核已内联
dist/cloudfunctions/<fn>/package.json  云端装依赖用
dist/cloudfunctions/<fn>/config.json   云调用权限 / 定时触发器
```

- `wx-server-sdk` 始终标记为 external：由云端注入，打进产物会破坏云调用。
- 中文字面量保持原样（`charset: 'utf8'`），云端日志里的报错文案可直接检索。
- 产物目录 `dist/` 不入库；部署前由 `scripts/deploy.js` 强制重建并校验。
- 源码目录里出现任何 `cloudfunctions/<fn>/common-*.js` 都会被 `npm run doctor` 判为错误——副本一旦回来，"产物必等于当前源码"这个前提就失效了。

## 日常操作

```bash
npm run build:functions        # 内联构建全部函数到 dist/cloudfunctions/
npm run build:functions:check  # 只校验产物是否与当前源码一致（CI 用）
npm run gate                   # 构建 + 契约 + ESLint + Prettier + 测试，本地一把梭
npm run doctor                 # 部署就绪度检查（appid / envId / 权限 / 产物新鲜度）
```

在微信开发者工具里上传云函数：`project.config.json` 的 `cloudfunctionRoot` 已指向 `dist/cloudfunctions/`，因此**先跑 `npm run build:functions`** 再右键上传，否则函数列表为空。

## 改了内核之后

不需要记得跑任何同步命令——重新构建即可，产物不可能包含旧内核。忘记构建的后果从"旧内核上线"降级为"上传的还是上一次构建的产物"，而 `build:functions:check` 会用源码指纹把这种情况报出来。

## 已知边界

- 本机构调试（云函数本地运行）时，`cloudfunctions/<fn>/index.js` 里的 `require('./common-bundle')` 无法解析——请调试 `dist/` 下的产物，或用 `npm run deploy:dev` 部署到 dev 环境验证。
- 内联产物是单文件，函数级断点定位会比多文件源码稍弱；产物未压缩（`minify: false`），堆栈行号与源码接近。
