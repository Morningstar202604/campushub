#!/usr/bin/env bash
#
# CampusHub 三方仓库镜像同步脚本
# 把 GitCode / GitHub / Gitee 三个平台的 campushub 仓库对齐到同一份代码。
#
# 用法:
#   ./scripts/sync-mirrors.sh                 # 以 GitCode(origin) 为准，镜像到 GitHub + Gitee
#   ./scripts/sync-mirrors.sh --from github  # 以 GitHub 为准，镜像到 GitCode + Gitee
#   ./scripts/sync-mirrors.sh --from gitee   # 以 Gitee 为准
#   ./scripts/sync-mirrors.sh --dry-run      # 只打印将要执行的操作，不实际推送
#
# 凭证(建议用环境变量 / CI secrets，不要硬编码进仓库):
#   GITCODE_TOKEN  GitCode 个人访问令牌(oauth2)
#   GH_TOKEN       GitHub PAT
#   GITEE_USER     Gitee 账号 (默认 badhope)
#   GITEE_TOKEN    Gitee 私人令牌 / 密码
#
# 受限网络(如某些沙箱把 github.com DNS 劫持到 198.18.0.0/15):
#   脚本自动检测劫持，并把 github.com 覆盖解析到真实 IP（写入 /etc/hosts，
#   同时写 ~/.user_hosts 以便工作区重启后保留）。SNI 保持 github.com 不变，
#   TLS 直通，无需任何额外进程——比自建 CONNECT 代理更稳更干净。
#   可显式 export GITHUB_IP=真实IP 跳过自动探测。
#
set -euo pipefail

# ---------- 配置 ----------
REPO_PATH="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${BRANCH:-main}"
MAIN_REMOTE="origin"          # 默认主仓 = GitCode
DRY_RUN=0
GITHUB_IP="${GITHUB_IP:-}"

GC_OWNER="badhope";  GC_REPO="campushub"
GH_OWNER="weed33834"; GH_REPO="campushub"
GE_OWNER="badhope";  GE_REPO="campushub"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)    MAIN_REMOTE="$2"; shift 2;;
    --branch)  BRANCH="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    -h|--help) sed -n '2,26p' "$0"; exit 0;;
    *) echo "未知参数: $1" >&2; exit 1;;
  esac
done

# gitcode 在远端实际名为 origin
MAIN_LABEL="$MAIN_REMOTE"
if [[ "$MAIN_REMOTE" == "gitcode" ]]; then MAIN_REMOTE="origin"; fi

# ---------- 受限网络: 用 /etc/hosts 把 github.com 指回真实 IP ----------
# 沙箱常把 github.com DNS 劫持到 198.18.0.0/15（RFC5737 文档地址段），但
# github.com 真实服务器本身可达。最干净的做法不是自建代理，而是直接把域名
# 解析覆盖到真实 IP——SNI 保持 github.com 不变，TLS 直通，无需任何额外进程。
# /etc/hosts 在「工作区重启」时才还原（会话内持久）；再写 ~/.user_hosts 以便
# 重启后保留。出口对真实 IP 偶有抖动，故 fetch/push 均带重试。
HOSTS_BAK=""
cleanup() {
  [[ -n "$HOSTS_BAK" && -f "$HOSTS_BAK" ]] && cp "$HOSTS_BAK" /etc/hosts 2>/dev/null || true
}
trap cleanup EXIT

with_retry() {
  local n=1 max=3
  until "$@"; do
    n=$((n + 1))
    [[ $n -gt $max ]] && { echo "[sync] ✗ 重试 $max 次仍失败: $*" >&2; return 1; }
    echo "[sync] 网络抖动，第 $n 次重试..."; sleep 3
  done
  return 0
}

ensure_github_reachable() {
  HOSTS_BAK="$(mktemp)"; cp /etc/hosts "$HOSTS_BAK"
  local cur
  cur="$(python3 -c "import socket;print(socket.gethostbyname('github.com'))" 2>/dev/null || true)"
  if [[ -n "$cur" && "$cur" != 198.18.* ]]; then
    echo "[sync] github.com 解析正常 ($cur)，无需处理"
    return 0
  fi
  echo "[sync] github.com 被 DNS 劫持 (${cur:-未知})，改用 /etc/hosts 覆盖到真实 IP"
  local candidates=()
  [[ -n "$GITHUB_IP" ]] && candidates+=("$GITHUB_IP")
  candidates+=(20.205.243.166 140.82.113.4 13.229.188.59 52.74.223.119 199.232.69.194 140.82.121.3 192.30.255.113)
  local chosen=""
  for ip in "${candidates[@]}"; do
    grep -v "github.com" "$HOSTS_BAK" > /etc/hosts
    echo "$ip github.com" >> /etc/hosts
    if timeout 15 git ls-remote github >/dev/null 2>&1; then
      chosen="$ip"; echo "[sync] ✓ github.com 经 $ip 可达"; break
    fi
  done
  if [[ -z "$chosen" ]]; then
    echo "[sync] ✗ 候选 IP 当前均不可达，请稍后重试或显式设置 GITHUB_IP" >&2
    cp "$HOSTS_BAK" /etc/hosts
    return 1
  fi
  # 持久化：/etc/hosts（会话内生效）+ ~/.user_hosts（重启后保留）
  grep -v "github.com" "$HOSTS_BAK" > /etc/hosts
  echo "$chosen github.com" >> /etc/hosts
  echo "$chosen github.com" >> ~/.user_hosts 2>/dev/null || true
}

gh_url() { [[ -n "${GH_TOKEN:-}" ]] && echo "https://${GH_OWNER}:${GH_TOKEN}@github.com/${GH_OWNER}/${GH_REPO}.git" || echo "https://github.com/${GH_OWNER}/${GH_REPO}.git"; }
ge_url() { [[ -n "${GITEE_TOKEN:-}" ]] && echo "https://${GITEE_USER:-badhope}:${GITEE_TOKEN}@gitee.com/${GE_OWNER}/${GE_REPO}.git" || echo "https://gitee.com/${GE_OWNER}/${GE_REPO}.git"; }
gc_url() { [[ -n "${GITCODE_TOKEN:-}" ]] && echo "https://oauth2:${GITCODE_TOKEN}@gitcode.com/${GC_OWNER}/${GC_REPO}.git" || echo "https://gitcode.com/${GC_OWNER}/${GC_REPO}.git"; }

# ---------- 主流程 ----------
cd "$REPO_PATH"

git remote remove github 2>/dev/null || true
git remote remove gitee 2>/dev/null || true
git remote add github "$(gh_url)"
git remote add gitee "$(ge_url)"
if [[ "$MAIN_REMOTE" == "origin" ]]; then
  git remote set-url origin "$(gc_url)"
fi

# remote 重建后再做可达性处理（git remote remove 会清掉对 github 的临时配置）
ensure_github_reachable

echo "[sync] 拉取所有远端..."
with_retry git fetch --all --prune

echo "[sync] 以 $MAIN_LABEL/$BRANCH 为准..."
git checkout "$BRANCH"
git reset --hard "$MAIN_REMOTE/$BRANCH"

TARGETS=()
[[ "$MAIN_REMOTE" != "github" ]] && TARGETS+=(github)
[[ "$MAIN_REMOTE" != "gitee"   ]] && TARGETS+=(gitee)
[[ "$MAIN_REMOTE" != "origin"  ]] && TARGETS+=(origin)

for t in "${TARGETS[@]}"; do
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[sync][dry-run] 将推送 $BRANCH -> $t"
  else
    echo "[sync] 推送 $BRANCH -> $t"
    with_retry git push "$t" "$BRANCH" --force-with-lease
  fi
done

echo "[sync] 完成。三仓已对齐到 $MAIN_LABEL/$BRANCH ($(git rev-parse HEAD))"
