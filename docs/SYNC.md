# 三方仓库同步（GitCode / GitHub / Gitee）

CampusHub 同时托管在三个平台，本文说明如何让它们保持一致。

| 平台 | 地址 | 角色 |
|------|------|------|
| GitCode | `gitcode.com/badhope/campushub` | 默认主仓（source of truth） |
| GitHub  | `github.com/weed33834/campushub` | 镜像 + Actions 自动扩散 |
| Gitee   | `gitee.com/badhope/campushub` | 镜像 |

---

## 方式一：一键脚本（推荐日常使用）

`scripts/sync-mirrors.sh` 会以某个平台为准，把代码强制对齐到另外两个平台。

```bash
# 以 GitCode(origin) 为准，镜像到 GitHub + Gitee（默认）
./scripts/sync-mirrors.sh

# 以 GitHub 为准
./scripts/sync-mirrors.sh --from github

# 以 Gitee 为准
./scripts/sync-mirrors.sh --from gitee

# 先预览，不实际推送
./scripts/sync-mirrors.sh --dry-run
```

脚本通过环境变量读取凭证（**不要硬编码进仓库**）：

```bash
export GITCODE_TOKEN="你的GitCode令牌"
export GH_TOKEN="你的GitHubPAT"
export GITEE_USER="badhope"
export GITEE_TOKEN="你的Gitee令牌"
./scripts/sync-mirrors.sh
```

可放进 crontab 定时跑（例如每小时），实现准实时同步：

```cron
0 * * * *  cd /path/to/campushub && GITCODE_TOKEN=xxx GH_TOKEN=xxx GITEE_TOKEN=xxx ./scripts/sync-mirrors.sh >> /var/log/sync.log 2>&1
```

## 方式二：GitHub Actions 自动镜像

`.github/workflows/mirror.yml` 已配置：当向 GitHub `main` 推送时，自动把改动 push 到 GitCode 与 Gitee（自动跳过 dependabot 提交，避免反向污染）。

使用前在 **GitHub 仓库 → Settings → Secrets** 配置：

- `GITCODE_TOKEN` — GitCode 个人访问令牌
- `GITEE_USER` — Gitee 账号（`badhope`）
- `GITEE_TOKEN` — Gitee 私人令牌 / 密码

## 从 GitCode / Gitee 发起更新时

- **GitHub → 另两家**：由上面的 Actions 自动完成。
- **Gitee → 另两家**：可在 Gitee 仓库「管理 → 仓库镜像管理」添加「推送镜像」指向 GitHub（服务端零维护）。
- **GitCode → 另两家**：手动跑一次 `./scripts/sync-mirrors.sh --from origin`，或用 GitCode 的 Webhook/CI 触发同一脚本。

## 受限网络（GitHub 被 DNS 劫持）

某些沙箱环境会把 `github.com` 解析到 `198.18.0.0/15` 黑洞地址，导致直连失败。脚本会自动检测劫持，并在（root 下）把 `github.com` 覆盖解析到真实 IP——写入 `/etc/hosts`（会话内生效）并同时写 `~/.user_hosts`（工作区重启后保留）。SNI 保持 `github.com` 不变，TLS 直通，**无需任何额外进程**；fetch/push 自带重试以容忍出口偶发抖动。

如需跳过自动探测，可显式指定真实 IP：

```bash
export GITHUB_IP="20.205.243.166"        # github.com 真实 IP（可选，不填则自动从候选列表探测）
./scripts/sync-mirrors.sh
```

> 不需要 `GITHUB_API_IP`：脚本只修正 `github.com` 这一个域名，其余平台直连即可。
> 真实 IP 偶随 CDN 变动；脚本内置候选 IP 列表会自动探测可达的那个，仍可手动用 `GITHUB_IP` 覆盖。
