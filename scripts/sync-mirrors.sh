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
#   设置 GITHUB_IP 为 github.com 真实 IP。脚本会启动一个本地代理把 github 流量
#   直连到真实 IP，完全不依赖 /etc/hosts（不受 hosts 定时还原影响）。
#   GITHUB_API_IP 可选（api.github.com 真实 IP）。
#
set -euo pipefail

# ---------- 配置 ----------
REPO_PATH="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${BRANCH:-main}"
MAIN_REMOTE="origin"          # 默认主仓 = GitCode
DRY_RUN=0
GITHUB_IP="${GITHUB_IP:-}"
GITHUB_API_IP="${GITHUB_API_IP:-}"

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

# ---------- 受限网络: 本地代理把 github 直连到真实 IP ----------
PROXY_PID=""
cleanup() {
  [[ -n "$PROXY_PID" ]] && kill "$PROXY_PID" 2>/dev/null || true
  git config --unset http.proxy 2>/dev/null || true
}
trap cleanup EXIT

ensure_github_reachable() {
  local ip
  ip="$(getent hosts github.com 2>/dev/null | awk '{print $1}' | head -1)"
  if [[ -z "$GITHUB_IP" ]]; then
    if [[ "$ip" == 198.18.* ]]; then
      echo "[sync] ⚠ github.com 被 DNS 劫持到 $ip，请设置 GITHUB_IP 以启用本地代理绕过。" >&2
    fi
    return 0   # 正常网络，无需处理
  fi
  echo "[sync] 启动本地代理，将 github.com 直连到真实 IP $GITHUB_IP (免疫 /etc/hosts 还原)"
  local port="${SB_PROXY_PORT:-19443}"
  cat > /tmp/sb_github_proxy.py <<PYEOF
import socket, threading, os
PORT = $port
GH = os.environ.get("GITHUB_IP", "$GITHUB_IP")
GH_API = os.environ.get("GITHUB_API_IP", "${GITHUB_API_IP:-$GITHUB_IP}")
MAP = {"github.com": GH, "api.github.com": GH_API, "*.github.com": GH}
def recv_until(c, marker=b"\r\n\r\n", timeout=5):
    buf = b""; c.settimeout(timeout)
    while marker not in buf:
        d = c.recv(4096)
        if not d: break
        buf += d
    return buf
def pipe(a, b):
    try:
        while True:
            d = a.recv(65536)
            if not d: break
            b.sendall(d)
    except Exception: pass
    finally:
        try: b.shutdown(socket.SHUT_WR)
        except Exception: pass
        try: a.close()
        except Exception: pass
def handle(c):
    try:
        data = recv_until(c)
        head, _, rest = data.partition(b"\r\n\r\n")
        parts = head.decode(errors="ignore").split()
        if len(parts) < 2 or parts[0] != "CONNECT":
            c.close(); return
        host, port = parts[1].rsplit(":", 1); port = int(port)
        target = MAP.get(host, MAP.get("*." + host.split(".", 1)[1], host))
        r = socket.create_connection((target, port), timeout=20)
        c.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        if rest: r.sendall(rest)
        c.settimeout(None)
        t1 = threading.Thread(target=pipe, args=(c, r), daemon=True); t1.start()
        t2 = threading.Thread(target=pipe, args=(r, c), daemon=True); t2.start()
    except Exception:
        try: c.close()
        except Exception: pass
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", PORT)); s.listen(128)
while True:
    conn, _ = s.accept()
    threading.Thread(target=handle, args=(conn,), daemon=True).start()
PYEOF
  GITHUB_IP="$GITHUB_IP" GITHUB_API_IP="${GITHUB_API_IP:-$GITHUB_IP}" \
    python3 /tmp/sb_github_proxy.py &
  PROXY_PID=$!
  export http_proxy="http://127.0.0.1:$port"
  export https_proxy="http://127.0.0.1:$port"
  git config http.proxy "http://127.0.0.1:$port"
  sleep 1
}

gh_url() { [[ -n "${GH_TOKEN:-}" ]] && echo "https://${GH_OWNER}:${GH_TOKEN}@github.com/${GH_OWNER}/${GH_REPO}.git" || echo "https://github.com/${GH_OWNER}/${GH_REPO}.git"; }
ge_url() { [[ -n "${GITEE_TOKEN:-}" ]] && echo "https://${GITEE_USER:-badhope}:${GITEE_TOKEN}@gitee.com/${GE_OWNER}/${GE_REPO}.git" || echo "https://gitee.com/${GE_OWNER}/${GE_REPO}.git"; }
gc_url() { [[ -n "${GITCODE_TOKEN:-}" ]] && echo "https://oauth2:${GITCODE_TOKEN}@gitcode.com/${GC_OWNER}/${GC_REPO}.git" || echo "https://gitcode.com/${GC_OWNER}/${GC_REPO}.git"; }

# ---------- 主流程 ----------
cd "$REPO_PATH"
ensure_github_reachable

git remote remove github 2>/dev/null || true
git remote remove gitee 2>/dev/null || true
git remote add github "$(gh_url)"
git remote add gitee "$(ge_url)"
if [[ "$MAIN_REMOTE" == "origin" ]]; then
  git remote set-url origin "$(gc_url)"
fi

echo "[sync] 拉取所有远端..."
git fetch --all --prune

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
    git push "$t" "$BRANCH" --force-with-lease
  fi
done

echo "[sync] 完成。三仓已对齐到 $MAIN_LABEL/$BRANCH ($(git rev-parse HEAD))"
