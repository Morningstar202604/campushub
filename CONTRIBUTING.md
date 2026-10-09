# Contributing

Thanks for your interest in contributing to **CampusHub**!

CampusHub is a WeChat mini-program + CloudBase project. The canonical source repository is
**GitCode** ([badhope/campushub](https://gitcode.com/badhope/campushub)), which is also mirrored
to **GitCode** and **Gitee**. All three stay in sync; you only need to open PRs against GitHub.

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/campushub.git
   cd campushub
   ```
3. Install dependencies and sync the shared kernel layer:
   ```bash
   npm install            # triggers prepublishOnly → auto-runs scripts/sync-common.js
   # or manually: npm run sync:common
   ```
   > `cloudfunctions/common/` is the single source of truth for auth / content-safety /
   > ban / rate-limit / response-format / content-deletion / index definitions. The sync
   > script copies it into every cloud function directory. **Never edit the `common-*.js`
   > copies inside individual function folders directly** — edit `cloudfunctions/common/` and re-run `npm run sync:common`.
   > There are currently **37 cloud functions**, all carrying synced copies of the 9 common modules.
4. Open the project in **WeChat DevTools** (fill in your own `appid` and cloud `env`).
5. Create a feature branch: `git checkout -b my-feature`.
6. Make your changes.
7. Commit with a clear, descriptive message (we follow [Conventional Commits](https://www.conventionalcommits.org/)).
8. Open a pull request against `main`.

## Code Style

- Follow the existing code style in the repository.
- Keep changes focused — one feature or fix per pull request.
- All UGC writes must go through the shared kernel layer (`requireActiveUser`, content-safety, `removeContent`); do not re-implement these per function.
- New cloud functions must include a `package.json` (so `sync-common.js` picks them up) and reuse `./common-bundle`.
- New database queries that rely on an index must add the definition to `cloudfunctions/common/common-indexes.js` (the single source of truth) and document it in `docs/INDEXES.md`.
- Add or update docs for any changed behavior.

## Reporting Issues

- Use [GitCode Issues](https://gitcode.com/badhope/campushub/issues) to report bugs or request features.
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
