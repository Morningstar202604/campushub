# 部署指南（v2 · 自建后端）

> v2 起后端为自建 NestJS 服务层 + PostgreSQL，不再依赖 Supabase 云。本文覆盖：本机开发、生产部署、前端 SPA fallback、图片存储。

---

## 一、本机开发（最快路径）

前置：Node 20+（建议 22）、PostgreSQL 14+（本机 127.0.0.1:5432）。

```bash
# 1. 服务层
cd apps/server
npm install                       # 沙箱/CI 环境请用 npx --yes npm@12 install
bash scripts/setup-db.sh          # 建库建用户（campushub/campushub@127.0.0.1:5432/campushub）
node scripts/seed.mjs             # 种子数据
bash scripts/make-demo.sh         # 演示数据（可选）
npm run build
node dist/main.js                 # 监听 :3000，全局前缀 /api

# 验证
curl http://localhost:3000/api/health          # → {"status":"ok",...}
curl http://localhost:3000/api-docs            # Swagger UI
curl http://localhost:3000/api-docs-json       # OpenAPI JSON（前端类型生成源）

# 2. 学生端
cd ../web
npm install
npm run dev                       # :5173，VITE_API_BASE=http://localhost:3000
```

**演示账号**：`xiaoming@campus.dev` / `xiaohong@campus.dev`，密码 `demo123456`。

> 数据库被清后恢复：依次跑 `setup-db.sh` → `seed.mjs` → `make-demo.sh`（演示脚本幂等，可重复执行）。

---

## 一·五、Docker Compose 一键部署（推荐）

无需在机器上装 Node / PostgreSQL，只要 Docker 环境（或服务器装 Docker + Compose 插件）。

```bash
# 1. 拉取代码
git clone https://github.com/X33834/campushub.git
cd campushub

# 2. 一键启动（自动：建库 → prisma 建表 → seed 种子 → make-demo 演示数据）
docker compose up -d --build

# 3. 访问
#    学生端    http://localhost:8080
#    管理后台  http://localhost:8081
#    API       http://localhost:3000/api   （Swagger: http://localhost:3000/api-docs）
```

**演示账号**：`xiaoming@campus.dev` / `xiaohong@campus.dev`，密码 `demo123456`。

**生产注意**：
- 修改 `docker-compose.yml` 中 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（默认占位仅适合演示）
- 数据与上传图片分别存在 named volume `pgdata` / `uploads`，`docker compose down` 不丢数据；彻底重置用 `docker compose down -v`
- 反向代理 / HTTPS 请置于 Compose 之前（或加一层 nginx/caddy 容器）

---

## 二、生产部署

### 拓扑

```
静态托管（Nginx / COS / OSS + CDN）→ 学生端静态文件（dist/）
轻量云服务器（2C4G）→ NestJS（:3000）+ PostgreSQL（同机或同 VPC）
图片存储 → 服务器磁盘 uploads/（当前），后置 OSS + CDN
```

### 1. 数据库（服务器或云 RDS）

```sql
-- 用 setup-db.sh 的 SQL 等价物建库建用户，或直接复用：
bash apps/server/scripts/setup-db.sh
node apps/server/scripts/seed.mjs
```

### 2. 服务层

```bash
cd apps/server
cp .env.example .env    # 按需改 DATABASE_URL / JWT_SECRET / UPLOAD_DIR / PORT
npm run build
# 进程管理（任选）：systemd / pm2
pm2 start dist/main.js --name campushub-api
```

环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| DATABASE_URL | postgresql://campushub:campushub@127.0.0.1:5432/campushub | Prisma 连接串 |
| JWT_SECRET | campushub-dev-secret-2026 | **生产必须更换**为强随机值 |
| UPLOAD_DIR | ./uploads | 图片落盘目录 |
| PORT | 3000 | 服务端口 |
| ACCESS_TTL / REFRESH_TTL | 15m / 7d | token 时效（可选） |

### 3. 学生端

```bash
cd apps/web
cp .env.example .env    # VITE_API_BASE 填生产 API 地址，如 https://api.example.com
npm run build           # 产出 dist/
```

**关键：SPA fallback**。前端是 `createWebHistory`（无 `#` 路由），静态服务器必须把未命中路径回退到 `index.html`：

```nginx
# Nginx 示例
location / {
  try_files $uri $uri/ /index.html;
}
```

> 否则直接刷新 `/market`、`/post/xxx` 等深链会 404。

### 4. 反向代理（若 API 与前端同域）

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_read_timeout 30s;
}
location /static/ {     # 图片
  proxy_pass http://127.0.0.1:3000;
}
```

---

## 三、图片存储（当前方案与演进）

- **当前**：`POST /api/upload/images` 落本地磁盘（`UPLOAD_DIR`），`/static/*` 静态访问，返回 `{urls}`。
- **演进（可选扩展）**：换 OSS / COS + CDN，上传接口改为"拿预签名直传"模式；前端 `lib/upload.ts` 的 `resolveStaticUrl` 已在 URL 组装层预留切换点。

---

## 四、成本（客观估算）

| 项 | 费用 |
|---|---|
| 轻量云服务器 2C4G（NestJS + Postgres + Redis 均可跑） | 约 100–200 元/年（活动价） |
| 域名 + CDN | 约 50–100 元/年 |
| 机审 API（可选扩展，按量） | 约 100–300 元/月（校园量级） |
| Sentry（可选扩展） | 免费档 |
| **合计（不含可选扩展）** | **约 200–300 元/年** |

---

## 五、上线前检查清单（对外发布前）

- [ ] `JWT_SECRET` 更换为强随机值
- [x] pino 结构化日志（应用日志 + HTTP 访问日志 JSON）
- [x] CI 门禁（三端构建 + 真 Postgres 单测 + 素材检查）
- [ ] 机审 API（可选扩展，需要时接入）
- [ ] Sentry（可选扩展，需要时接入）
- [ ] 图片存储切 OSS（可选扩展；当前目录权限 / 大小 / 类型白名单已加固）
- [ ] 备份策略（pg_dump 定时）
