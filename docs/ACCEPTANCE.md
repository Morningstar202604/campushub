# CampusHub 交付验收报告

> 面向企业买家 | 报告日期：2026-09-22 | 编制：交付验收（QA）
> 口径与《交付手册》`docs/HANDOVER.md` 一致；本报告所有结论均附可追溯证据（文件路径 / 实测数字）。
> 验证级别说明：本项目交付验证为**静态 / 构建级**（类型检查、双端构建、结构扫描、契约比对、安全扫描），**不含**真机功能回归、HBuilderX 云打包、CloudBase 真实环境联调（详见第五节「未覆盖项」）。

---

## 一、验收结论：有条件通过

**判断依据**：仓库内全部可静态验证的质量门均实测通过——类型检查 0 错误、H5 与微信小程序双端构建成功（exit=0）、20 页面结构与致命反模式扫描零命中、前端 29 个云函数调用与后端 38 个函数目录零缺失、编辑功能 5 个落盘文件结构配平且禁用串零命中、双仓库安全扫描零真实凭据。但**功能正确性尚未在真机 + 真实 CloudBase 环境闭环**，且存在 2 项 M 级遗留风险（见第三节）。因此本结论为「有条件通过」：**买方按下文「复跑验证」命令在自有环境复现通过、并按 HANDOVER 第六节验收清单完成真机回归后，即可转为正式签收。**

---

## 二、检查矩阵

| # | 检查项 | 方法（命令） | 结果 | 证据文件 / 数字 |
|---|--------|--------------|------|-----------------|
| 1 | 依赖安装 | `npm install`（campushub-uni，锁版本 `package-lock.json`） | 通过 | `node_modules/` 已就绪，本轮 vue-tsc 复跑基于该环境成功执行 |
| 2 | 类型检查 | `npx vue-tsc --noEmit`（等同 `npm run type-check`） | **通过（exit=0，输出 0 行）** | 本轮实测重跑 `campushub-uni/scripts/_typecheck_rerun.log`（0 字节，2026-09-22 10:3x）。⚠️ 注意：历史摘要 `_build_summary.txt` 记录 `typecheck_exit=2`（产出时间 10:06，早于当前代码态），对应 `_typecheck.log` 已被清空（mtime 10:07:49）——**以本轮实测重跑 exit=0 为准** |
| 3 | H5 构建 | `npm run build:h5`（uni build -p h5） | 通过（exit=0） | `_build_summary.txt` L5：`h5_exit=0`；`_build_h5.log` 尾部 `DONE Build complete.`（仅 Sass legacy-js-api 弃用警告，非阻塞） |
| 4 | 微信小程序构建 | `npm run build:mp-weixin` | 通过（exit=0） | `_build_summary.txt` L11：`mp_exit=0`；`_build_mp.log` 尾部 `DONE Build complete.` + 产出目录提示 `dist\build\mp-weixin` |
| 5 | 页面结构 / 致命反模式扫描 | `python scripts/verify_pages.py` | 通过 | `scripts/verify_pages.out.txt`：page_count=20；31 文件反模式扫描 `real_code_hits=0`；`struct_failures=0`；样式分层（pages_importing_tokens=0）与 14 项关键一致性点 `consistency_failures=0` |
| 6 | 契约交叉校验（前端 ↔ 后端） | 全 src 抽取 `callFunction('xxx')` 字面量 ∪ `fnName` 间接调用，与 `cloudfunctions/` 目录比对 | 通过 | 实测：字面量函数 **29 个**（含 `post-update` / `product-update`，即编辑功能后端已接入）、`fnName` 间接调用 11 处（post-list / product-list 等）；后端 `campushub/cloudfunctions/` **38 目录**；**比对缺失 = 0** |
| 7 | 编辑功能专项核验 | `python scripts/_verify_edit.py` | 通过 | `_verify_edit.out.txt`：my-list / post-create / product-create / product-detail / adapters 共 5 文件关键改动全部落盘（`missing: NONE`），括号/标签/文本配平全部成对，`forbidden_real_code_hits=0`，`VERDICT=PASS`。说明：输出中两处 `STILL BAD` 为校验脚本对 `form.images.splice(i,1)`（合法数组删除操作）的启发式误报，非真实缺陷，最终判据 `forbidden_real_code_hits=0` 为准 |
| 8 | 编辑模式落盘抽查（人工复核） | grep 关键改动点 | 通过 | post-create.vue L17 编辑模式提示文案、L61/L77 编辑态隐藏块；my-list.vue L46 `.my-edit` 编辑入口；adapters/index.ts L74/L169 `status` 字段映射（`on_sale` / `normal` 默认值） |
| 9 | CloudBase v2 SDK 修正抽查 | 阅读 `src/utils/api.ts` | 通过 | L184 `sdk.init({ env: schoolStore.envId })`（env 参数名正确）；L263-268 `app.getTempFileURL`（v2 官方形态，异常时降级透传 fileID）；上传走 `app.uploadFile` 返回 fileID 并以返回值为准（L280-295）；小程序端 `wx.cloud` 由 main.ts 托管 |
| 10 | 安全扫描（A 仓库 + B 仓库 git 历史） | 全量 blob 扫描（security-engineer 产线，主理人已采信） | 通过 | A 仓库零敏感命中；B 仓库 57 commits 全量 blob 扫描零真实凭据（`miniprogram/config/school.js` 仅占位 `envId:'campushub'`，无 restToken / secret）；A 仓库 `.gitignore` 已补 `.env` / `*.local` |
| 11 | 交付手册一致性 | 对照 `docs/HANDOVER.md` | 通过 | 本报告目录结构、构建命令、已知限制、验收清单均与 HANDOVER 第七节口径一致（HANDOVER 写 37 个可部署函数，`cloudfunctions/` 实际 38 目录 = 37 函数 + `common` 共享库，不单独部署，口径无矛盾） |

---

## 三、遗留风险表

| 级别 | 风险事项 | 来源 | 建议 |
|------|----------|------|------|
| M | H5/App 端 `restToken` 打包进前端产物，可被提取逆向 | HANDOVER 已知限制 | 上线后改短时效 token / 企业自建网关代理 |
| M | `comment-create` 通知的 `targetType` 写死 `'post'`，商品评论通知会跳错详情页 | HANDOVER 已知限制 | 后端一行回填真实 targetType |
| M | 静态/构建级验证无法证明运行时功能正确性（分页、图片上传、状态流转等均未真机回归） | 本报告补充 | 买方按第五节复现 + HANDOVER 第六节清单真机回归后再签收 |
| L | 他人主页粉丝/关注数被后端脱敏，仅展示发帖数 | HANDOVER 已知限制 | 产品决策，如需开放改云函数 |
| L | `build:app`（安卓）必须经 HBuilderX 云打包，无本地 CLI 通道，本轮未验证 | HANDOVER 已知限制 + 本报告未覆盖项 | 交付方备 HBuilderX 账号后按 `uni-app/docs/ANDROID_BUILD.md` 执行 |
| L | 通知/消息无推送通道，仅站内拉取 | HANDOVER 已知限制 | 后续接微信订阅消息 |
| L | App / tabbar 图标为品牌占位图，正式发布前需替换 | HANDOVER 第五节 | 交付方提供正式 VI 素材 |
| L | 构建期 Sass legacy-js-api 弃用警告（Dart Sass 2.0 将移除旧 API） | `_build_h5.log` / `_build_mp.log` | 非阻塞；建议后续升级 sass 配置消除 |
| L | `_verify_edit.py` 对 `form.images.splice` 存在启发式误报（输出 STILL BAD 但实为合法代码） | 本报告补充 | 校验脚本白名单该模式，避免误导后续验收人 |

---

## 四、买家复跑验证（可原样执行）

环境要求：Node.js ≥ 18（建议 20/22 LTS）。以下命令在 `campushub-uni/` 目录下原样执行：

```bash
cd campushub-uni

# 1. 依赖安装（锁版本）
npm install

# 2. 全量类型检查（期望：无任何输出，退出码 0）
npm run type-check

# 3. H5 构建（期望：尾部 DONE Build complete.，产物 dist/build/h5）
npm run build:h5

# 4. 微信小程序构建（期望：尾部 DONE Build complete.，产物 dist/build/mp-weixin）
npm run build:mp-weixin

# 5. 页面结构 / 反模式 / 一致性终验（Python 标准库，无需装包；期望三项 failures/hits 均为 0）
python scripts/verify_pages.py

# 6. 编辑功能专项核验（期望：VERDICT=PASS 且 forbidden_real_code_hits=0）
python scripts/_verify_edit.py
```

> 注：第 5/6 步脚本输出中的 `STILL BAD` 为已知误报（见检查矩阵 #7、风险表 L 项），以最终 `real_code_hits=0` / `forbidden_real_code_hits=0` / `VERDICT=PASS` 为准。
> 后端部署（CloudBase 环境、37 函数、HTTP 访问、匿名登录、索引/TTL、init-db）不在上述复跑范围，按 `docs/DEPLOY.md` 十步走完后再做真机回归。

---

## 五、验证覆盖边界（如实告知：做了什么，没做什么）

**已覆盖（静态 / 构建级）**：
- 依赖安装与锁版本环境下的 vue-tsc 全量类型检查（本轮实测 exit=0）
- H5 与微信小程序双端构建成功（exit=0，产物目录确认）
- 20 页面结构完整性、致命反模式（反编译白名单串、硬编码色值、重复 createApp 等）零命中
- 样式分层与 14 项关键一致性点零失败
- 前端 29 字面量 + 11 处 fnName 间接调用与后端 38 目录契约零缺失
- 编辑功能 5 文件落盘 + 结构配平 + 禁用串零命中 + 关键代码人工抽查
- 双仓库凭据泄露扫描（A 仓库工作区 + B 仓库 57 commits 全量 git 历史）零真实凭据

**未覆盖（交付验证的边界，买方须知）**：
1. **真机功能回归**：未在任何真机/模拟器上执行 HANDOVER 第六节验收清单（登录、四 tab 信息流分页、发帖/编辑/删除、商品状态流转、评论点赞收藏举报、搜索、签到积分、反馈等）——全部功能正确性结论仅到「代码落盘 + 构建通过」级别。
2. **HBuilderX 云打包（安卓 APK）**：未执行，`build:app` 无本地 CLI 通道，证书与 versionCode 基线见 `uni-app/docs/ANDROID_BUILD.md`。
3. **CloudBase 真实环境联调**：未部署云函数、未连真实 envId 验证 callFunction 链路、未验证图片上传（app.uploadFile → fileID → getTempFileURL 全链路）、未验证 HTTP 访问 + restToken 鉴权、未验证匿名登录开启后的 H5 上传。
4. **微信审核链路**：小程序 AppID 配置、上传、提审流程未执行。

以上未覆盖项均需买方在自有 CloudBase 环境 + 自有 AppID 下完成，对应操作步骤见 `docs/HANDOVER.md` 第三节至第六节。

---

## 六、验收清单（转正式签收前置条件）

- [ ] 按第四节命令在买方环境复跑：type-check / build:h5 / build:mp-weixin / verify_pages / _verify_edit 全部通过
- [ ] 按 `docs/DEPLOY.md` 完成 CloudBase 部署（37 函数、HTTP 访问、匿名登录、索引/TTL、init-db、task-expire 触发器）
- [ ] 按 HANDOVER 第六节「验收清单」完成 H5 与小程序双端真机回归
- [ ] 复核 M 级风险两项（restToken 加固方案、comment-create targetType 修复）的处理计划
- [ ] 正式发布前替换占位图标、配置企业 AppID

---

*本报告由交付验收（QA）基于仓库内实际产物与实测输出编制，未修改任何业务代码；所有数字均可按第四节命令复现。*
