# CampusHub 企业交付手册（HANDOVER）

> 本文档面向**接手本项目的企业交付方**。目标是：拿到仓库后，按本文走完「后端部署 → 前端配置 → 三端构建 → 验收」全流程。
> 深度细节见 `docs/DEPLOY.md`（后端部署 10 步）、`uni-app/docs/ANDROID_BUILD.md`（安卓打包）、`uni-app/README.md`（前端架构）。

---

## 一、交付物构成

本仓库为 **monorepo**，一次 clone 拿到全部：

```
campushub/
├── cloudfunctions/     # 后端：37 个 CloudBase 云函数（唯一事实源）
│   └── common/         # 共享库（ok()/fail()/鉴权/内容安全），随各函数打包
├── uni-app/            # 前端：uni-app(Vue3+Vite) 三端，微信小程序 / H5 / 安卓 APK
│   ├── src/            #   20 个页面 + pinia + 适配层 + 设计系统「墨荧 · Acid Campus」
│   ├── scripts/        #   可复跑校验脚本（纯 Python 标准库，无需装包）
│   └── docs/           #   安卓打包手册 / 设计系统 / 版本基线
├── docs/               # 产品级文档：DEPLOY / COST / COMPLIANCE / INDEXES / USER_GUIDE …
├── index.html          # 产品落地页
└── LICENSE / README.md
```

> **旧版原生小程序 `miniprogram/` 已移除**：uni-app 版是全功能替代（小程序端由 `uni-app` 编译产出），git 历史中仍可回溯。

## 二、环境要求

| 项 | 要求 |
|----|------|
| Node.js | ≥ 18（建议 20/22 LTS） |
| 包管理 | npm（依赖已锁版本，`package-lock.json` 随仓库交付） |
| 微信开发者工具 | 最新稳定版（小程序预览 / 上传 / 云函数部署） |
| HBuilderX | 最新版（安卓云打包必需，`build:app` 无本地 CLI 通道） |
| CloudBase（TCB） | 一个按量付费环境（成本估算见 `docs/COST.md`） |
| 资质 | 企业微信小程序 AppID；安卓发布证书（可用 DCloud 云端证书起步） |

## 三、后端部署（约 30 分钟）

1. CloudBase 控制台创建环境，记下 **envId**（形如 `campushub-1a2b3c`）。
2. 部署 `cloudfunctions/` 下**全部 37 个函数**（微信开发者工具「云开发」面板右键逐个上传，或 CloudBase CLI 批量；`common/` 是共享库，会被各函数 require，不单独部署）。
   - 若手动同步过 common：根目录 `package.json` 提供 `sync:common` 脚本。
3. 控制台开启**HTTP 访问服务**（H5/App 端走 REST 调用必需），鉴权方式按 `docs/DEPLOY.md`，并生成 **restToken**。
4. 控制台「身份验证登录」开启**匿名登录**（H5/App 端云存储上传/临时链接的前置条件，未开启会导致图片上传失败）。
5. 建立 3 个索引 + 1 个 TTL（清单与字段见 `docs/INDEXES.md`）。
6. 运行 `init-db` 函数初始化集合与种子分类；确认 `task-expire` 定时触发器已配置。

## 四、前端配置（换一所学校 = 改两个文件）

1. `uni-app/src/config/school.config.js`：
   - `envId`：第二步的环境 ID
   - `schoolName` / `schoolId`：学校显示名与数据隔离 ID（多校隔离靠它）
   - `restToken`：第三步生成的 HTTP 访问令牌（仅 H5/App 端用；小程序端走 `wx.cloud` 免 token）
2. `uni-app/src/manifest.json`：
   - `mp-weixin.appid`：企业小程序 AppID（小程序上传必填）
   - 顶层 `appid`：DCloud AppID（安卓云打包必填，HBuilderX 内「重新获取」）
   - 同时把仓库根 `project.config.json` 的 `appid` 填为同一企业小程序 AppID ——
     它承载 `cloudfunctionRoot`（微信开发者工具的云函数面板依赖它），且 `npm run doctor`/一键部署会校验非空
3. 微信小程序端还需在 CloudBase 控制台把该 AppID 加入「Web 安全域名 / 小程序授权」。

## 五、三端构建

```bash
cd uni-app
npm install                # 依赖已锁版本；如遇 peer 冲突先核对 package.json 不要用 --force
npm run build:h5           # 产物 dist/build/h5 → 任意静态托管 / CDN
npm run build:mp-weixin    # 产物 dist/build/mp-weixin → 微信开发者工具导入 → 上传审核
npm run type-check         # vue-tsc 全量类型检查（CI 建议保留）
```

- **安卓 APK**：HBuilderX 导入 `uni-app/` → 云打包。证书方案、权限清单、回滚预案见 `uni-app/docs/ANDROID_BUILD.md`。
- 图标：`src/static/app-icons/`（App）与 `src/static/tabbar/`（小程序 tabBar）当前为品牌占位图，正式发布前替换。

## 六、验收清单（逐项打勾后再签收）

**后端**
- [ ] 37 个云函数全部部署成功，无「缺少 common」报错
- [ ] HTTP 访问服务开启，curl 带 `restToken` 调 `login` 返回 `success:true`
- [ ] 索引/TTL 建立；`init-db` 执行成功
- [ ] 定时触发器 `task-expire` 生效

**前端（H5 与小程序双端各过一遍）**
- [ ] 登录（openid 静默授权）与资料编辑
- [ ] 四个 tab 信息流（首页/市集/表白墙/失物招领）加载与分页、下拉刷新、触底加载
- [ ] 发帖 / 发商品（含多级分类下钻）、**编辑已发内容**、删除
- [ ] 商品「标记已售 / 重新上架」状态流转
- [ ] 帖子详情：评论（含回复）、点赞、收藏、举报；商品详情：点赞、收藏、举报（评论暂未开放，与旧版一致）
- [ ] 搜索三 tab、校园指南列表+富文本详情、关注列表、通知中心（含关注类通知跳转对方主页）
- [ ] 签到 + 连续天数、积分商城兑换（rename-token 100 分）
- [ ] 意见反馈提交

**安全**
- [ ] `school.config.js` 无真实凭据残留（交付版为占位值）
- [ ] HTTP 访问服务鉴权已启用（不能裸奔匿名写）
- [ ] CloudBase 安全规则 / 数据隔离按 `docs/COMPLIANCE.md` 复核

## 七、已知限制与风险（如实告知）

| 级别 | 事项 | 建议 |
|------|------|------|
| M | H5/App 端 `restToken` 打包进前端产物，可被提取 | 上线后改短时效 token / 企业自建网关代理 |
| L | 评论目前仅开放在**帖子**详情（商品详情无评论入口，与旧版小程序一致；后端 `comment-create` 已支持 targetType=product，如需开放直接在商品详情接入 `useComments({ targetType: 'product' })` 即可） | 产品决策 |
| L | 他人主页粉丝/关注数被后端脱敏，仅展示发帖数 | 产品决策，如需开放改云函数 |
| L | `build:app` 必须经 HBuilderX 云打包，无本地 CLI 通道 | 交付方备 HBuilderX 账号 |
| L | 通知/消息无推送通道（仅站内拉取） | 后续可接订阅消息 |

## 八、回滚与版本

- 本次交付以 git tag `delivery-*` 标记；旧版小程序等历史在 git 历史中可回溯。
- `uni-app/docs/versions.json` 记录 versionCode / 证书基线；安卓升级必须单调递增 versionCode。

---

*交付状态以随附《交付验收报告》为准（含构建/类型检查/安全扫描的实际输出）。*
