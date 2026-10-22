# H5 网站与安卓 APK 部署指南

> 三端同源：`uni-app/src` 一份代码，编译出微信小程序 / H5 网站 / 安卓 APK。
> 后端（CloudBase 云函数 + 数据库 + 存储）三端共用，无需分别部署。
> 本文只讲 H5 与 APK 两条落地路径，小程序部署见 `docs/DEPLOY.md`。

---

## 零、先决条件：三端共用的一次性配置

三端都读 `uni-app/src/config/school.config.js`：

```js
const schoolConfig = {
  envId: '',        // ← 必填：CloudBase 环境 ID
  restToken: '',    // ← H5/APK 必填：CloudBase「HTTP 访问服务」的 Bearer Token
  demoMode: true
}
```

| 字段 | 小程序 | H5 / APK | 说明 |
|---|---|---|---|
| `envId` | 需要 | 需要 | 空 = 进入演示模式，数据只存本机 |
| `restToken` | 不需要 | **必填** | REST 端点的访问鉴权；生成方式见下 |
| `demoMode` | 建议 `true` | 建议 `true` | `envId` 一旦填写，本开关自动失效 |

**生成 `restToken`**：CloudBase 控制台 → 环境 → 「访问控制 / HTTP 访问服务」→ 开启并创建 Token。
端点形如 `https://{envId}.api.tcloudbasegateway.com/v1/functions/{name}?webfn=true`。

### 身份密钥 `IDENTITY_SECRET`（H5/APK 登录的命门）

H5 与 APK 走 REST，请求里没有微信 `OPENID`。服务端用 HMAC-SHA256 签发**设备令牌**替代：

```bash
openssl rand -hex 32        # 生成一个 64 位随机串
```

把它配置到**每个云函数**的环境变量（微信开发者工具 → 云函数 → 配置 → 环境变量，或 `cloudbaserc.json`）。
配错或漏配的后果：

| 情况 | 表现 |
|---|---|
| 全部函数都配了同一个值 | 正常，令牌跨函数通用 |
| 某个函数漏配 | 该函数用 envId 派生盐验签 → 令牌全部验不过 → `AUTH_REQUIRED` |
| 各函数配了不同的值 | 同上，按函数随机失败 |

> 未配置时不会崩，但会打 `[identity] 未配置 IDENTITY_SECRET` 告警并退化为
> `fallback:${envId}` —— 知道 envId 的人可以伪造任意设备身份，**生产环境必须配**。

---

## 一、H5 网站

### 1.1 构建

```bash
cd uni-app
npm ci
npm run build:h5          # 产物：uni-app/dist/build/h5/
```

产物结构：

```
dist/build/h5/
├── index.html
├── assets/           # JS/CSS，带内容哈希，可长期缓存
└── static/           # 图片等静态资源
```

单页体积约 1.7 MB（未压缩）。已配置 `h5.router.mode = "hash"`、`h5.router.base = "./"`，
因此**放在任意子路径都能跑，且不需要服务端 rewrite 规则**。

### 1.2 部署到静态托管

任选其一，把 `dist/build/h5` 整个目录上传即可：

| 方案 | 命令 / 操作 |
|---|---|
| CloudBase 静态托管 | 控制台 → 静态网站托管 → 上传 `dist/build/h5` |
| Nginx / Apache | 拷贝到站点根目录 |
| GitHub Pages / Gitee Pages | 推到 `gh-pages` 分支 |
| Vercel / Netlify | 构建命令 `npm run build:h5`，输出目录 `uni-app/dist/build/h5` |

**Nginx 参考配置**（hash 路由不需要 `try_files` 重写，但建议加上以防将来切 history 模式）：

```nginx
server {
    listen 80;
    server_name campushub.example.com;
    root /var/www/campushub;
    index index.html;

    # 带哈希的静态资源可长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html 绝不缓存，否则发版后用户拿到旧壳 + 新资源会白屏
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

### 1.3 必须一起做的三件事

1. **CORS**：CloudBase HTTP 访问服务默认允许跨域；若自建反代，需放行 `POST` + `Content-Type`、`Authorization`。
2. **HTTPS**：`fetch` 与存储 SDK 都要求安全上下文；`http://` 下 H5 的图片压缩/上传会失败。
3. **`IDENTITY_SECRET`**：见第零节，漏配则登录后仍被拒。

### 1.4 上线自检

```bash
curl -I https://your-domain/                 # 200，且 Content-Type: text/html
curl -I https://your-domain/assets/<hash>.js # 200，且带长缓存头
```

浏览器打开后逐项确认：

- [ ] 首页四个 tab 都在，能切换
- [ ] 无 DEMO 横幅（有横幅 = `envId` 没填，还在演示模式）
- [ ] 打开控制台 Network，`login` 请求的响应里有 `identityToken`
- [ ] 发一条帖子成功，刷新后仍在
- [ ] 直接访问 `https://your-domain/#/pages/market/market` 能正常渲染（深链刷新）
- [ ] 切换到浅色主题，刷新后保持

---

## 二、安卓 APK

### 2.1 技术形态说明（先说清楚边界）

本仓库的 APK 是**WebView 壳**：把 H5 产物打进 `assets/www`，用系统 WebView 加载。

| 能做 | 不能做 |
|---|---|
| 全部页面、登录、发帖、评论、点赞、上传图片 | 微信登录 / 微信支付 |
| 本地存储、主题、深链 | 原生推送（需接厂商通道） |
| 返回键走页面栈 | 相机/相册的原生体验（退化为浏览器 `<input file>`） |

要完整原生能力，需用 HBuilderX 云打包或 DCloud 离线 SDK —— 那需要 DCloud 账号与证书，
不在本仓库的自动化范围内。

### 2.2 构建

前置：JDK 17+、Android SDK（`platforms;android-34` + `build-tools`）、`JAVA_HOME` 与 `ANDROID_HOME` 已设置。

```bash
npm run build:apk
# 等价于：构建 H5 → 同步到 android/app/src/main/assets/www → gradle assembleRelease → 复制到 out/
```

产物：`out/campushub-<YYYYMMDD>.apk`（约 2.8 MB）。

复用已有 H5 产物可加 `--skip-h5`。

### 2.3 签名（正式发布必做）

模板默认用 debug 签名，**不能上架任何应用商店**。生成正式 keystore：

```bash
keytool -genkeypair -v -keystore campushub-release.jks \
  -alias campushub -keyalg RSA -keysize 2048 -validity 10000
```

在 `android/app/build.gradle` 的 `android { }` 中加：

```gradle
signingConfigs {
    release {
        storeFile file(System.getenv("CAMPUSHUB_KEYSTORE") ?: "campushub-release.jks")
        storePassword System.getenv("CAMPUSHUB_STORE_PASSWORD")
        keyAlias System.getenv("CAMPUSHUB_KEY_ALIAS")
        keyPassword System.getenv("CAMPUSHUB_KEY_PASSWORD")
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

> 口令走环境变量，**不要写进仓库**。keystore 文件本身也要加入 `.gitignore`。

### 2.4 安装与自检

```bash
adb install -r out/campushub-<date>.apk
adb shell am start -n com.campushub.app/.MainActivity
```

逐项确认：

- [ ] 首屏正常渲染，四个 tab 可切换
- [ ] 进详情页后按返回键回到列表（不是直接退出）
- [ ] 无 DEMO 横幅（有横幅 = `envId` 没填）
- [ ] 发帖成功，杀掉进程重进后内容还在
- [ ] 上传图片能选到相册（走系统文件选择器）
- [ ] 切浅色主题后导航栏与页面一起变

### 2.5 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 白屏 | H5 产物用了绝对路径 `/assets/` | `manifest.json` 的 `h5.router.base` 必须是 `"./"`；`build-apk.js` 会主动拦截 |
| 页面能开但操作全失败 | `envId` / `restToken` 没填 | 检查 `school.config.js`，重打包 |
| 登录后仍 `AUTH_REQUIRED` | `IDENTITY_SECRET` 没配或不一致 | 见第零节 |
| 图片上传失败 | 未开匿名登录 / 无 HTTPS | CloudBase 控制台开「匿名登录」 |
| 返回键直接退出 | 未走页面栈判断 | 已在 `MainActivity.onBackPressed()` 处理，若仍复现请附 `adb logcat` |

---

## 三、三端一致性检查（发版前跑一遍）

```bash
npm run gate          # 后端 218 条 + 契约 + lint + 格式
npm run test:frontend # 前端 32 条（含设备令牌链路）
cd uni-app && npx vue-tsc --noEmit
```

三端共用同一份 `api.ts`，平台差异只在 `getPlatform()` 一处分流：

| 端 | 调用方式 | 身份来源 |
|---|---|---|
| 微信小程序 | `wx.cloud.callFunction` | 平台注入 `OPENID` |
| H5 | `fetch` → CloudBase HTTP 访问服务 | 设备令牌 `__identity` |
| 安卓 APK | 同 H5（WebView 内跑 H5 产物） | 设备令牌 `__identity` |

> 因此 **H5 能跑通，APK 的接口层就一定能跑通** —— 两者是同一份 JS。
> APK 独有的风险只在 WebView 能力（文件选择、存储配额、返回键），已在 2.4 逐项覆盖。
