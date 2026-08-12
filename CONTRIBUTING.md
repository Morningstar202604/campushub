# Contributing

Thanks for your interest in contributing to **CampusHub**!

CampusHub is a WeChat mini-program + CloudBase project. The canonical source repository is
**GitHub** ([weed33834/campushub](https://github.com/weed33834/campushub)), which is also mirrored
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
   > There are currently **34 cloud functions**, all carrying synced copies of the 8 common modules.
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

- Use [GitHub Issues](https://github.com/weed33834/campushub/issues) to report bugs or request features.
- Include steps to reproduce for bug reports.
- **Do not** open public issues for security vulnerabilities — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE) (see also [NOTICE](NOTICE)).
