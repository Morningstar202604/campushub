# Contributing

Thanks for your interest in contributing to **CampusHub**!

CampusHub is a uni-app (Vue 3 + Vite) + WeChat CloudBase project. The project is mirrored on
four platforms with the same branch / tag / HEAD:
[GitHub (X33834)](https://github.com/X33834/campushub),
[GitHub (Morningstar202604)](https://github.com/Morningstar202604/campushub),
[GitCode](https://gitcode.com/badhope/campushub) and
[Gitee](https://gitee.com/badhope/campushub). Issues and PRs are welcome on any of them.

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/campushub.git
   cd campushub
   ```
3. Install dependencies and build the cloud functions:
   ```bash
   npm install              # build-time devDeps (esbuild / prettier / eslint)
   cd uni-app && npm install && cd ..   # frontend deps (uni-app / Vite / pinia)
   npm run build:functions  # inline the kernel into dist/cloudfunctions/
   ```
   > `cloudfunctions/common/` is the single source of truth for auth / content-safety /
   > ban / rate-limit / response-format / content-deletion / index definitions. **Never create
   > `common-*.js` copies inside individual function folders** — edit `cloudfunctions/common/`
   > only; `npm run build:functions` inlines the kernel into `dist/` at build time, and
   > `npm run doctor` / the pre-commit hook reject any copy that reappears.
   > There are currently **10 deployment units** (7 resource gateways + 3 standalone functions)
   > hosting 37 business entries.
4. Open the project in **WeChat DevTools** (fill in your own `appid` and cloud `env`).
5. Create a feature branch: `git checkout -b my-feature`.
6. Make your changes.
7. Commit with a clear, descriptive message (we follow [Conventional Commits](https://www.conventionalcommits.org/)).
8. Open a pull request against `main`.

## Code Style

- Follow the existing code style in the repository.
- Keep changes focused — one feature or fix per pull request.
- All UGC writes must go through the shared kernel layer (`requireActiveUser`, content-safety, `removeContent`); do not re-implement these per function.
- New cloud functions must include a `package.json` (the cloud installs deps from it) and reuse `./common-bundle`; add a `config.json` with `permissions.openapi` if the function calls any WeChat openapi (missing declarations make fail-closed moderation reject every publish).
- New database queries that rely on an index must add the definition to `cloudfunctions/common/common-indexes.js` (the single source of truth) and document it in `docs/INDEXES.md`.
- Add or update docs for any changed behavior.

## Reporting Issues

- Use the [issue tracker](https://github.com/Morningstar202604/campushub/issues) to report bugs or request features (GitHub is the platform with Actions enabled, so CI feedback is visible there).
- Include steps to reproduce for bug reports.
- **Do not** open public issues for security vulnerabilities — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE) (see also [NOTICE](NOTICE)).

## 发布流程（维护者）

每次对外更新按此清单执行，不跳步：

1. **定版本**：按语义化版本（SemVer）——修 Bug 升补丁位、新功能升次版本、破坏性改动升主版本
2. **同步文档**：改代码的同时更新 README（版本/截图，如界面有变）与依赖清单（requirements / package.json）
3. **本地验证**：跑通测试与构建（与 CI 同款命令），全绿才继续
4. **合并**：以 PR 方式合入 `main`，CI 全绿后合并
5. **打标签**：`git tag -a vX.Y.Z -m "vX.Y.Z"` 并推送（`git push origin vX.Y.Z`）
6. **发布**：基于该 tag 创建 GitHub Release，Release Notes 写清本次变更要点
7. **部署**：确认 GitHub Pages / 站点自动部署完成且可访问

变更记录以 GitHub Releases 与 git log 为准。
