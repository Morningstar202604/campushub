# 云函数收敛：37 个入口 → 10 个部署单元

> 状态：**代码已收敛并本地全绿，尚未在任何云环境部署验证**。
> 因此本分支不直接合入 main；请按下面的上线顺序在 dev 环境走一遍再合。

## 为什么做

微信云开发免费/基础套餐的硬配额里有几项会先撞到：**云函数数量 50 个**、数据库集合 100 个、数据库写 3 万次/天。原仓库有 37 个云函数目录，每个都要独立上传、独立声明 openapi 权限、独立冷启动；再加功能就逼近上限。

官方对配额超限的处置建议本身就是"合并多个云函数，通过参数区分功能"。所以收敛不是审美偏好，是配额约束下的标准解。

| 收敛前 | 收敛后 |
|---|---|
| 37 个云函数目录（= 37 个部署单元） | **10 个部署单元**：7 个资源型网关 + `task-expire` / `backup-db` / `init-db` |
| 业务入口与部署单元 1:1 | 业务入口仍是 37 个（handler），只是住在网关里 |
| 37 份 `config.json` 权限声明 | 10 份，且由路由表推导并集 |
| 产物合计约 341KB / 10 函数（内核内联 10 次） | 对比收敛前 37 函数需内联 37 次 |

网关划分（唯一事实来源：仓库根 `gateway-routes.json`）：

| 部署单元 | 承载入口 |
|---|---|
| `api-auth` | login、user-profile、user-update、verify |
| `api-post` | post-list、post-detail、post-create、post-update、post-delete、my-list、resolve |
| `api-product` | product-list、product-detail、product-create、product-update、product-delete |
| `api-comment` | comment-list、comment-create、comment-delete |
| `api-social` | like、collect、follow、notification、checkin、points |
| `api-admin` | admin、category-list、category-manage、announcement、feedback-create、report |
| `api-content` | guide-list、guide-detail、search |
| 独立函数 | task-expire（6h 定时）、backup-db（03:00 定时）、init-db（控制台手动） |

## 机制

- 入口 = `event.fn`。网关只按 `fn` 分发，**鉴权、限频、内容安全全部留在 handler 内部**——收敛部署单元不等于收敛校验点。
- 客户端**直连**网关，`getWXContext().OPENID` 仍是真实用户身份（不经云函数二次转发，不存在身份丢失）。
- 未登记的 `fn` 一律返回 `UNKNOWN_FUNCTION`，不会打到别的入口。
- 前端 `callFunction('post-create', data)` **一行都不用改**：`uni-app/src/utils/api.ts` 经生成的路由表把请求改写为 `api-post` + `fn:'post-create'`；日志与错误文案仍显示业务入口名。
- 附带收紧：调用名从"只校验字符集"升级为"必须在路由表白名单内"。原先任何能拼出合法函数名的调用点，都可以直接打到 `init-db` / `admin` 这类高危函数上。

生成物（`cloudfunctions/api-*/index.js`、`config.json`、`package.json`、`uni-app/src/config/gateway-routes.ts`）都由 `scripts/gen-gateways.js` 从 `gateway-routes.json` 推导。**改路由只改 JSON，然后跑 `npm run gen:gateways`**；手改生成物会被 `npm run gate` 拦下。

## 上线顺序（必须按序）

1. 本地：`npm install --include=dev` → `npm run gate` 必须退出码 0。
2. `npm run build:functions` → 产物在 `dist/cloudfunctions/`。
3. **部署 7 个网关到 dev 环境**，旧的 37 个函数**先不要在控制台删除**（这就是回滚锚点）。
4. 控制台：为 7 个网关开启 HTTP 访问服务并配置鉴权（H5/App 端要用；旧函数的 REST 配置不影响）。
5. `task-expire`、`backup-db` 重新部署一次即可，触发器绑定不变；`init-db` 保持环境变量 `INIT_SECRET`。
6. 前端把 `gateway-routes.json` 的 `useGateway` 设为 `true` → `npm run gen:gateways` → 构建三端 → 指向 dev 环境冒烟。
7. 冒烟与留痕：逐条填 [docs/DEPLOY_VERIFICATION.md](DEPLOY_VERIFICATION.md)（含 task-expire / backup-db 两个定时器与负向用例），每条都要看返回码，不要只看界面：
   - 登录、资料读取与修改（`api-auth`）
   - 发**带图**帖（`api-post`：验证 `imgSecCheck` 同步 Buffer 形态在真机是否通过——这是本仓无法在沙箱证伪的一项）
   - 评论 + 点赞 + 关注 + 通知（`api-social` / `api-comment`）
   - 后台：举报列表、类目 CRUD、公告（`api-admin`）
   - 搜索热词与翻页（`api-content`）
   - **负向用例**：手工调用 `api-post` 传 `fn:'init-db'` → 必须 `UNKNOWN_FUNCTION`
   - 限频：同一账号 30s 内连发两帖 → 第二条必须 `RATE_LIMITED`；60s 内连改 7 次帖子 → 第 7 次必须 `RATE_LIMITED`
8. dev 全绿后再上 prod，同样的冒烟一遍。
9. 稳定观察 1–2 周后，按 `docs/DEPLOY_VERIFICATION.md` 第四节顺序在控制台删除旧的 37 个函数，配额才真正释放。

## 回滚

只改一个开关，不动业务代码：

1. `gateway-routes.json` → `"useGateway": false`
2. `npm run gen:gateways && npm run build:functions`
3. 重新发布前端。此时前端按原名直连旧函数；旧函数只要没在控制台删掉就仍然可用。

代码级回滚：`git revert` 本分支的合并提交，再按 main 的说明部署 37 个函数目录。

## 本分支已验证 vs 未验证

已验证（本地）：`npm run gate` 全绿（网关一致性、权限并集、触发器保留、产物可解析且内联当前内核、`fn` 不污染落库数据、路由表白名单）；90 项测试；`contract-check` 0 错误（前端 29 入口 / 37 业务入口 / 10 部署单元）。

**未验证（必须云环境）**：网关形态下 `getWXContext()` 的实际身份传递、`imgSecCheck` 真机返回、H5 REST 网关对 7 个新函数的鉴权配置、以及冷启动与单次调用耗时的真实变化（网关装载 7 个 handler，首次调用比单入口函数略重）。
