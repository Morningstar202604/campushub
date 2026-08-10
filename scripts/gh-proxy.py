#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地 HTTP CONNECT 代理：把 github.com 系域名强制指向真实 IP，绕开沙箱 DNS 劫持。

背景：
  某些沙箱/受限网络把 github.com 的 DNS 解析劫持到 198.18.0.0/15 保留段，
  直连会在 TLS 握手阶段失败（SSL_ERROR_SYSCALL / GnuTLS recv error -110）。
  本代理不依赖 /etc/hosts（不受定时还原影响），只在建立 CONNECT 隧道时
  把目标域名替换成真实 IP，TLS 仍由 git/curl 端到端完成，SNI 与证书校验不受影响。

用法：
  python3 scripts/gh-proxy.py [PORT]
  环境变量 GITHUB_IP / GITHUB_API_IP 可覆盖内置 IP。

  git -c http.proxy=http://127.0.0.1:19443 push github main
"""
import os
import select
import socket
import sys
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("SB_PROXY_PORT", 19443))

GH = os.environ.get("GITHUB_IP", "20.205.243.166")
GH_API = os.environ.get("GITHUB_API_IP", "20.205.243.168")

HOSTMAP = {
    "github.com": GH,
    "www.github.com": GH,
    "api.github.com": GH_API,
    "codeload.github.com": os.environ.get("GITHUB_CODELOAD_IP", GH),
    "objects.githubusercontent.com": "185.199.108.133",
    "raw.githubusercontent.com": "185.199.108.133",
}


def pipe(a, b):
    """双向转发，任一端 EOF 才整体收尾。

    不要写成单向 recv 循环 + shutdown(SHUT_WR)：那会让 TLS 连接被过早半关闭，
    git 侧会报 "GnuTLS recv error (-110): The TLS connection was non-properly terminated"。
    """
    try:
        while True:
            r, _, _ = select.select([a, b], [], [], 300)
            if not r:
                break
            for s in r:
                try:
                    data = s.recv(65536)
                except Exception:
                    return
                if not data:
                    return
                (b if s is a else a).sendall(data)
    except Exception:
        pass


def handle(client):
    upstream = None
    try:
        client.settimeout(30)
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = client.recv(4096)
            if not chunk:
                return
            buf += chunk
            if len(buf) > 32768:
                return

        head, _, rest = buf.partition(b"\r\n\r\n")
        first = head.decode("latin-1").split("\r\n")[0]
        parts = first.split()
        if len(parts) < 2 or parts[0].upper() != "CONNECT":
            client.sendall(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n")
            return

        hostport = parts[1]
        if ":" in hostport:
            host, port_s = hostport.rsplit(":", 1)
        else:
            host, port_s = hostport, "443"

        target = HOSTMAP.get(host.lower(), host)
        upstream = socket.create_connection((target, int(port_s)), timeout=20)
        upstream.settimeout(None)
        client.settimeout(None)
        client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")

        # 关键：CONNECT 头之后可能已粘包带上了 TLS ClientHello，必须转发，否则隧道会静默卡死
        if rest:
            upstream.sendall(rest)

        pipe(client, upstream)
    except Exception as e:
        try:
            client.sendall(("HTTP/1.1 502 Bad Gateway\r\n\r\n" + str(e)).encode())
        except Exception:
            pass
    finally:
        for s in (client, upstream):
            try:
                if s:
                    s.close()
            except Exception:
                pass


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", PORT))
    srv.listen(128)
    print("[gh-proxy] listening on 127.0.0.1:%d  github=%s api=%s" % (PORT, GH, GH_API), flush=True)
    while True:
        conn, _ = srv.accept()
        threading.Thread(target=handle, args=(conn,), daemon=True).start()


if __name__ == "__main__":
    main()
