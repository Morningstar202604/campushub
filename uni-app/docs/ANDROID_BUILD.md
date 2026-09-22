# CampusHub · uni-app 安卓 APK 打包手册（P5）

> 目标：让 `campushub-uni`（uni-app Vue3 + Vite）经 **HBuilderX 云打包** 产出可安装、可验收、可回滚的 **Android APK**。
> 配套已改：`src/manifest.json` 的 `app-plus.distribute.android` 已补齐包名/版本/SDK/权限（见「§0 前置」）。
> 关键事实：HBuilderX 云打包**不是 npm 命令**，是 HBuilderX IDE 的图形化能力（云打包 → 选安卓 → 选证书/包名 → 云端出 APK）。
> 因此本手册重点是：① manifest 字段；② 可照做的打包操作；③ 证书/包名/版本规划；④ 回滚与验收 checklist。

---

## §0 前置条件（打包前必须完成）

1. **HBuilderX 已安装且可用云打包**（HBuilderX 3.9+，登录 DCloud 账号，云打包走云端）。
   - 云打包需联网到 DCloud 云端服务器（不是「不拉网络装 npm 包」——云打包本身是构建服务，会拉 SDK 编译；与「不引入新 npm 依赖」不冲突）。
2. **`src/config/school.config.js` 填入真实值**：
   - `envId`（CloudBase 环境 ID，如 `campushub-1a2b3c`）
   - `restToken`（CloudBase「HTTP 访问服务」自定义 Token；H5/App 端 REST 调用 401 检查项）
   - **安全**：此文件含密钥，**不得提交 git**；多校部署时按「改一个 envId + 一套图标 + restToken」单点替换。
3. **CloudBase 控制台**：为登录/各公开云函数开启「HTTP 访问服务」，鉴权方式「自定义 Token」（与 restToken 匹配）。
4. **应用图标**：`src/static/app-icons/android/{hdpi,xhdpi,xxhdpi,xxxhdpi}.png`（规范尺寸 72/96/144/192）与 `src/static/app-icons/ios/appstore.png`（1024，RGB 无 alpha）**已由 `scripts/gen_placeholder_icons.py` 生成占位图**（品牌深底 `#0D110E` + 荧光青柠 `#C8F135` 圆角方块）—— 此前这 5 个文件从未存在，HBuilderX 云打包会直接因「图标文件不存在」失败，现已修复。误删目录可随时用 `python scripts/gen_placeholder_icons.py` 重新生成。**上线前必须用同路径同名覆盖为正式「墨荧 · Acid Campus」品牌图标。**
5. **`appid`（顶层 `manifest.json` 的 `appid` 字段）**：HBuilderX **云打包必填**（DCloud 应用标识，在 HBuilderX 登录后「manifest 可视化 → 基础配置 → AppID」点「重新获取」）。留空会导致云打包报「未获取到 appid / AppID 不存在」。
6. **`mp-weixin.appid`**（本次安卓打包不涉及，可留空；H5 同理）。

---

## §1 manifest.json 的安卓字段说明（已落地）

`src/manifest.json` → `app-plus.distribute.android` 关键字段（已合法 JSON，`node -e` 校验通过）：

| 字段 | 当前值 | 含义 / 取舍 |
|---|---|---|
| `packagename` | `com.campushub.app` | 安卓包名，全局唯一；升级/换校时保持同一包名以支持覆盖安装。 |
| `versionCode` | `100` | 整数，**只增不减**，决定「是否可覆盖升级」；HBuilderX 云打包按此递增。 |
| `versionName` | `1.0.0` | 人类可读版本号，展示给用户。 |
| `minSdkVersion` | `21`（Android 5.0） | 最低支持 5.0；99% 存量设备覆盖，图片/相机 API 全可用。 |
| `targetSdkVersion` | `34`（Android 14） | 面向 14 编译，兼容新设备与 Google Play 基线。 |
| `compileSdkVersion` | `34` | 编译 SDK，与 target 对齐。 |
| `abiFilters` | `armeabi-v7a`、`arm64-v8a` | 主流双 ABI；省体积、避开 x86 模拟器。纯 App（无 native .so 强依赖）够用。 |
| `permissions` | 见下 | 声明式清单（HBuilderX 会注入 AndroidManifest）。 |

**权限清单（8 项，逐项对应业务）**：

| 权限 | 业务依据 | 备注 |
|---|---|---|
| `INTERNET` | 所有 REST / 图片上传 / 云函数 | 必需 |
| `ACCESS_NETWORK_STATE` / `ACCESS_WIFI_STATE` | 网络探活、上传策略 | 伴生 |
| `CAMERA` | `uni.chooseImage` 拍照路径（user-update / post-create / product-create） | 仅相册可不声明相机，但留全 |
| `READ_MEDIA_IMAGES` | Android 13+ 新选图模型 | 与下方旧权限并存 |
| `READ_EXTERNAL_STORAGE` | 读相册/存储（图片选择/上传、Android 12 及以下） | 必需 |
| `WRITE_EXTERNAL_STORAGE` | 写存储（缓存/导出，targetSdk<30 下有效） | 高版本系统对 App 私有目录放行 |
| `CALL_PHONE` | `product-detail` 的 `uni.makePhoneCall`（联系人拨号） | 隐私敏感，仅拨号不读通讯录 |

> [待核实] `WRITE_EXTERNAL_STORAGE` 在 `targetSdkVersion=30+` 上已被 Android 忽略（scoped storage）。查证路径：HBuilderX 云打包生成 `unpackage/resources/__UNI__XXXXX/AndroidManifest.xml` 与 Google 官方 scoped storage 文档；若后续上架应用市场，可在上架包里删掉 WRITE 项，仅保留 READ_MEDIA_IMAGES + 旧 READ 以兼容低端机。
> [待核实] 云打包在 `targetSdkVersion=34` 下对 `com.campushub.app` 的 ABI 过滤是否默认生成 v7a+v8a 双包。查证路径：HBuilderX「云打包」日志「生成 ABI」段。

---

## §2 HBuilderX 云打包操作手册（从打开工程到拿到 APK）

### 步骤 0 · 准备
- 用 **HBuilderX** 打开 `campushub-uni` 工程（不是 VS Code；HBuilderX 识别 `src/manifest.json` 与 `src/pages.json`）。
- 确认 `src/config/school.config.js` 已填 `envId` + `restToken`。
- 确认应用图标占位（§0-4）。

### 步骤 1 · 本地先跑通编译（可选但强烈建议）
```bash
cd campushub-uni
npm install          # 首次
npm run build:app    # 编译安卓端产物（HBuilderX 云打包的前置校验）
```
> `build:app` 产物落在 `unpackage/dist/build/app/`。云打包最终由 HBuilderX 云端出 APK，但本地 `build:app` 能提前暴露编译错误。

### 步骤 2 · 云打包
1. HBuilderX 菜单：**发行 → 原生App-云打包**（Release → App-云打包）。
2. 勾选 **Android**（先只打安卓）。
3. **证书方式**（二选一，详见 §3）：
   - A. **使用 HBuilderX 证书**（免费、最省事，适合内测/校园分发）：勾选「使用 HBuilderX 证书」，云端自动签名。
   - B. **使用自己 keystore**（正式/上架）：勾选「使用自有证书」，填：
     - 证书文件路径：`campushub-release.keystore`（§3.2 创建，放工程外）
     - 证书别名：`campushub`
     - 证书密码：`<STORE_PASS>`
     - 密钥别名：`campushub`
     - 密钥密码：`<KEY_PASS>`
4. **包名**：`com.campushub.app`（与 manifest 一致）。
5. **版本**：`versionName=1.0.0`、`versionCode=100`（与 manifest 一致；若手动改需 ≥ 上次）。
6. 选 **Android SDK 版本**：勾选 **API 34**（与 targetSdk 对齐；可选勾 API 33/34 出多包）。
7. **自定义权限**：云打包界面会勾选权限项；确保 §1 的 8 项都已勾（尤其 INTERNET / 存储 / 相机 / CALL_PHONE）。
8. 点 **打包**，云端编译约 3–8 分钟。

### 步骤 3 · 产物位置
- HBuilderX 云端完成后，APK 下载目录（默认 `工程/unpackage/release/android/` 或 HBuilderX 指定下载目录）：
  - `CampusHub-release.apk`（自有证书签名）
  - `CampusHub-HBuilderX-release.apk`（HBuilderX 证书签名）
- **务必记录当前 `versionCode`**，并保留 APK 文件本身（命名 `CampusHub-1.0.0-100.apk` 归档）——这是回滚基线（§5）。

### 步骤 4 · 首装验证（人工）
1. 真机（Android 5.0+，建议一台 8.0+ 一台 14）用 **adb** 或「传 APK 到手机 → 允许未知来源 → 安装」。
2. 首次安装后按 §6 checklist 逐项过（登录 → 首页 → 详情 → 发布 → 签到 → 图片上传/预览 → 深色视觉）。

---

## §3 证书规划（.keystore 创建 + 云打包证书方式对比）

### 3.1 两种证书方式对比

| 维度 | HBuilderX 证书 | 自有 .keystore |
|---|---|---|
| 成本 | 免费（DCloud 代签） | 自管（keystore 文件 + 密码） |
| 有效期 | 云端代签，跟随 DCloud | 自控 10–25 年（建议 25 年） |
| 适用 | 内测、校园分发、快速验证 | 正式上架应用市场、需稳定升级 |
| 升级约束 | 同一证书才可覆盖；换证书必须改包名 | 同一 keystore 才可覆盖；**丢失密码 = 永远无法升级** |
| 推荐 | **当前内测/验收** | **正式上线 / P6 之后上架** |

> **决策**：P5 验收阶段用 **HBuilderX 证书**（零成本、可立即出包）；P6/上架前切 **自有 .keystore**（25 年，长期升级基线）。

### 3.2 创建自有 .keystore（keytool 一步流）
```bash
# 在工程外安全目录创建（勿放工程内、勿进 git）
mkdir -p ~/campushub/certs
cd ~/campushub/certs

# 生成 10000 天（≈27 年，对齐 docs/versions.json.keystore）keystore（别名 campushub，RSA-2048）
keytool -genkey -v \
  -keystore campushub-release.keystore \
  -alias campushub \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <STORE_PASS> -keypass <KEY_PASS> \
  -dname "CN=CampusHub, OU=Campus, O=CampusHub, L=, ST=, C=CN"

# 校验
keytool -list -keystore campushub-release.keystore
```
- **备份**：`campushub-release.keystore` + 两个密码（STORE_PASS / KEY_PASS）存密码管理器 + 异机冷备。
- **keystore 不入库**（放 `~/campushub/certs/` 工程外，`versions.json.keystore.filename` 已标注「不入库」）。
- **云打包**时把 keystore 路径填入「使用自有证书」项。

### 3.3 证书 / 版本规划

> **单一事实源：`docs/versions.json`**（含 baseline、sdk、upgrade_rules、keystore、history，人工读，CI/打包不消费）。本节只摘要关键决策，与 `versions.json` 冲突时以 `versions.json` 为准。

- **版本基线**：`versionName=1.0.0` / `versionCode=100`（P5 首版可安装基线，见 `versions.json.history[0]`）。
- **升级规则**（摘自 `versions.json.upgrade_rules`）：patch 末位+1 / minor 中位+1（versionCode 跨一位）/ major 首位+1；**硬规则：每次发版前 `versionCode = 上一线上最大 + 1`，且 `src/manifest.json` 两处（顶层 + `app-plus.distribute.android`）与 `versions.json.baseline` 三者必须一致**。
- **证书**（摘自 `versions.json.keystore`）：`campushub-release.keystore`，keyAlias `campushub`，RSA-2048，**有效期 10000 天（≈27 年，覆盖整个产品周期，无需续期）**；不入库、放工程外。
- **切证书策略**：P5 验收用 **HBuilderX 证书**；P6/上架前切**自有 keystore**，且切换放在 1.0→1.1 主版本边界（避免 HBuilderX 证书包被自有证书包覆盖失败）。

> 注意：`versions.json` 的 keystore 有效期是 **10000 天 ≈ 27 年**（本手册 §3.2 keytool 示例默认写 9125 天≈25 年，以 `versions.json` 的 10000 天为准，keytool `-validity` 填 `10000`）。

---

## §4 可观测性与构建告警（打包侧）

> 打包/首装侧关注「构建是否成功、首装是否崩溃、链路是否通」，不接线上 APM。

| 信号 | 采集方式 | 告警阈值 |
|---|---|---|
| 云打包成功/失败 | HBuilderX 云打包日志 + `unpackage/release/android/*.apk` 是否产出 | 打包失败 → 阻断发布，回溯 §2 权限/证书 |
| 首装崩溃 | 真机安装后 3 秒内未崩 + 首页可见 | 白屏/崩溃 → 走 §5 回滚 |
| REST 401 | App 启动后首页加载日志 `401` | 首包 REST 全 401 → 检查 `restToken`/envId（§0-2） |
| 图片上传失败 | 发布页 toast「图片上传失败」 | 核心链路图片不通 → 检查 CloudBase 存储 + `@cloudbase/js-sdk` 懒加载 |

---

## §5 回滚预案（可执行、已定路径）

### 5.1 打包失败（云端出不了 APK）
- **定位**：HBuilderX 云打包日志。常见：① 权限未勾全（§1）；② 证书路径/密码错（§3）；③ 应用图标缺失（§0-4）。
- **降级**：
  - 先本地 `npm run build:app` 确认非编译错误；
  - 换「HBuilderX 证书」（绕开自有证书配置）重打；
  - 图标缺失则临时用 `static/tabbar` 占位图替换 `app-icons` 后重打。

### 5.2 首装崩溃 / 白屏
- **第一步**：确认不是「旧版 HBuilderX 证书包被自有证书包覆盖」导致 signature 不匹配——清旧包重装。
- **降级路径 A（回上一稳定 APK）**：安装 §3 表中上一个成功验收的 `versionCode` APK（保留的归档文件）。
- **降级路径 B（H5 兜底）**：用 `npm run build:h5` 出 H5，部署到静态 CDN；用户改走「浏览器/微信内 H5」完成核心链路（登录→首页→详情→发布→签到），安卓 App 暂停更新。
  - H5 兜底前置：`restToken` 已在 H5 环境生效；图片 fileID 走 `@cloudbase/js-sdk`（H5 可用）。

### 5.3 线上 token / 安全事件
- 若 `restToken` 泄漏：CloudBase 控制台**立即重置** Token，同步 `src/config/school.config.js`，**重打 APK**（token 烧进包内）；过渡期 H5 侧同步更新反代配置。

---

## §6 验收 Checklist（缺一项视为未完成）

### A. 打包侧
- [ ] `src/manifest.json` `app-plus.distribute.android` 合法 JSON（`node -e` 校验通过）
- [ ] 包名 `com.campushub.app`、`versionCode=100`、`versionName=1.0.0`
- [ ] 权限 8 项全勾（INTERNET / 存储读写 / 相机 / CALL_PHONE）
- [ ] 应用图标占位就位（`app-icons/android/*`）
- [ ] HBuilderX 云打包出 APK，产物在 `unpackage/release/android/`
- [ ] `restToken` + `envId` 已注入 `school.config.js`（不进 git）

### B. 安卓真机首装（Android 8.0 + Android 14 各一台）
- [ ] APK 可安装、首启不崩（3 秒内进首页）
- [ ] **核心链路**：登录 → 首页 feed → 详情（post/product）→ 发布（post-create/product-create）→ 每日签到，全程通
- [ ] **图片上传/预览**：选图 → 压传云存储 → fileID → 详情/列表预览正常（无 `@cloudbase/js-sdk` 降级透传）
- [ ] **拨号**：product-detail 联系人手机号 → `makePhoneCall` 拉起拨号
- [ ] **深色视觉**：墨黑底 `#0D110E` + 荧光青柠 `#C8F135` 在真机正常，无白底/样式丢失
- [ ] **存储权限**：Android 13+ 选图自动授 `READ_MEDIA_IMAGES`，不弹 `WRITE_EXTERNAL_STORAGE`

### C. 回滚可执行
- [ ] 上一稳定 APK 已归档（`CampusHub-1.0.0-100.apk`）
- [ ] H5 兜底路径（`npm run build:h5` → CDN）已验证可发
- [ ] restToken 重置 → 重打 APK 流程已演练

---

## §7 已知风险与遗留（H/M/L）

| 风险 | 等级 | 说明 / 缓解 |
|---|---|---|
| `@cloudbase/js-sdk` 在 App 端懒加载兼容性 | **M** | `api.ts` 用 `await import('@cloudbase/js-sdk')` 动态引入；若云打包后图片转链降级透传 fileID（预览显示空白），需改静态 import 并打进 App 运行时。验收 B-图片项重点抓。 |
| 安卓真机首装（HBuilderX 证书） | **M** | HBuilderX 证书包与自有证书包不可互相覆盖；升级前务必确认装的是同一证书。 |
| token 注入安全 | **H** | `restToken` 烧进 APK 包内，理论上可被反编译提取；正式环境应在 CloudBase 反代 + 网关层兜底，避免裸 token 直连（见 api.ts §安全说明 4）。 |
| 应用图标占位 | **M** | `app-icons` 未生成正式图时云打包用默认图，上架前必须换墨荧品牌图标。 |

---

## §8 给 P6（视觉全面上妆）的 3 个打包侧前置确认

1. **品牌图标替换点**：`src/static/app-icons/android/*` + `src/static/tabbar/*` 必须换墨荧品牌图标后再打 P6 正式包（P6 视觉验收以「图标 + 深色底」整体现象为准）。
2. **深色视觉回归**：P6 换肤后，用本手册 §6-B「深色视觉」项在真机复验（尤其 wot-design-uni 暗黑令牌在 App 端渲染）。
3. **证书/版本衔接**：P6 若出「首个正式上架包」，在 1.0→1.1 版本边界切自有 keystore（§3.3），不要在 HBuilderX 证书内测包之上覆盖。

---

*维护：DevOps（吴运维）。变更 manifest / 版本 / 证书策略时，同步更新本文件 §1/§3/§5/§6。*
