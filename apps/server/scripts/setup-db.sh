#!/bin/bash
# M1 环境准备脚本：安装并启动 PostgreSQL → 创建 campushub 用户/库 → prisma db push 建表
# 用法：bash scripts/setup-db.sh
set -e
cd "$(dirname "$0")/.."

echo "== [1/3] 安装并启动 PostgreSQL =="
if ! dpkg -l postgresql 2>/dev/null | grep -q '^ii'; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi
sudo service postgresql start 2>/dev/null || sudo pg_ctlcluster $(ls /etc/postgresql | head -1) main start
sleep 2

echo "== [2/3] 创建 campushub 用户 / 库 =="
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='campushub'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER campushub WITH PASSWORD 'campushub';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='campushub'" | grep -q 1 || \
  sudo -u postgres createdb -O campushub campushub

echo "== [3/3] Prisma db push（建表） =="
npx prisma db push --skip-generate

echo "=== 完成：数据库就绪，启动服务用 npm run start:dev ==="
