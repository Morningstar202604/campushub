# DESIGN_SYSTEM.md — 墨荧 · Acid Campus

> 全栈战队 P6「视觉全面上妆」的验收基准。配套令牌已落地 `src/styles/tokens.scss`。
> 立场：电影感 / 暗黑基调 / 高冲击力 / 有氛围感，**反模板、反「AI 味」**。
> 旧原生仓 94 处 `#0052d9` + `#4A90D9` 双蓝系打架是「AI 味」根源——uni-app 重写后已归零，本系统让视觉有一个统一的、可被人工验收的标尺。

---

## 〇、设计立场（为什么长这样）

- **不是校园论坛的清新蓝白**，是一张「夜场海报」：黑底、一道荧光、硬边、贴纸感。
- 深色为默认，浅色只作「打印版降级」（`[data-theme="light"]`），日常不进浅色。
- 每一屏只允许**一个荧光焦点**（#C8F135），其余一律退灰——焦点稀缺才有冲击力。
- 视觉签名动作：斜切角标签（`.clip-tag`）+ 硬投影（`.sticker`），是这套体系区别于「圆角卡片 + 软阴影」模板 App 的指纹。

---

## 一、色板（tokens.scss `:root`）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg-page` | `#0D110E` | 页面底（墨黑偏绿） |
| `--bg-card` | `#151A16` | 卡片底 |
| `--bg-elevated` | `#1D241F` | 浮层/弹窗底 |
| `--accent` | `#C8F135` | **唯一荧光焦点**（青柠） |
| `--accent-dim` | `#8FB31F` | 焦点弱化/描边 |
| `--secondary` | `#35E0C8` | 电光青（次级强调，稀疏用） |
| `--danger` | `#FF6B5E` | 报错/举报/删除 |
| `--warning` | `#FFC94D` | 预警（积分不足/改名限额） |
| `--success` | `#5FE08A` | 成功态 |
| `--text-primary` | `#F2F5F0` | 主文字 |
| `--text-secondary` | `#9AA39A` | 次级文字 |
| `--text-tertiary` | `#5C655C` | 占位/弱说明 |
| `--border` | `#2A322C` | 1px 硬边框 |

**反 AI 味硬约束**：全站**禁止**默认蓝紫（#0052d9 / #4A90D9 / 任何紫渐变）、禁止多色系同时上主视觉。主色永远是 `--accent` 青柠，青只作次级。

---

## 二、圆角（只两档）

- `--radius-sharp: 8rpx`（卡片/标签默认）
- `--radius-pill: 28rpx`（按钮/胶囊/tab 指示）
- **禁止** 12 / 16 / 20 等中间档圆角；出现即视为跑题。

---

## 三、投影（无软影）

- 只允许两种：`1px 硬边框`（`border: 1px solid var(--border)`）或 `.sticker` 硬投影（`0 4rpx 0 rgba(0,0,0,.6)`）。
- **禁止** 模糊软阴影（`box-shadow: 0 8px 24px` 这类弥散影）——那是「AI 卡片感」的最大来源。

---

## 四、字重

- `--fw-title: 900`（标题/焦点数字/按钮）
- `--fw-body: 400`（正文）
- 标题额外 `letter-spacing: -0.5rpx`（`.title-900`）；数字等宽用 `.tabular-nums`（价格/积分/计数自动变荧光）。

---

## 五、间距（4 的倍数）

`--sp-1:8 / --sp-2:16 / --sp-3:24 / --sp-4:32 / --sp-5:48`（rpx）。页内留白克制，靠底/焦点/边框分层，不靠密集堆叠。

---

## 六、品牌签名

- `.clip-tag`：斜切角标签（`clip-path` 切右下角 8rpx），用于分类/角标/价格签——是整套体系的「指纹」。
- `.sticker`：贴纸硬投影，用于 FAB/主 CTA/积分卡。
- 每页顶部的 `KICKER` 小标（`letter-spacing 4rpx` + `--accent` + 900）已在本项目页面里统一落地（P4 各页均带）。

---

## 七、反 AI 味 8 条铁律（P6 验收逐条过）

1. **禁默认蓝紫**：主视觉 0 个蓝紫；主色恒为 #C8F135。
2. **禁 emoji 空态**：空态用文字 + KICKER，不用 😊 / 🎉。
3. **圆角只 8/28**：出现其他圆角即跑题。
4. **无软投影**：只有 1px 边框或 0 4rpx 0 硬投影。
5. **字重 900 vs 400**：标题 900、正文 400，不堆 500/700。
6. **斜切角标签**：分类/角标统一走 `.clip-tag`。
7. **每屏一个荧光焦点**：一屏内 #C8F135 高亮元素 ≤1 处，其余退灰。
8. **深色默认**：默认即 #0D110E 墨黑，浅色只在打印降级。

---

## 八、P6 验收 checklist（逐项打勾才交付）

- [ ] 全站 grep 无 `#0052d9` / `#4A90D9` / 任何蓝紫主视觉
- [ ] 所有卡片圆角 ∈ {8rpx, 28rpx}
- [ ] 所有投影 = 1px 边框 或 `0 4rpx 0`（无模糊软影）
- [ ] 标题字重 900、正文 400
- [ ] 每屏荧光焦点 ≤1
- [ ] 空态文字化（无 emoji）
- [ ] 分类/角标走 `.clip-tag` 斜切角
- [ ] FAB / 主 CTA / 积分卡有 `.sticker` 贴纸硬投影
- [ ] wot-design-uni 组件（picker/toast/tab）在 App 端渲染成暗黑令牌，未漏出默认浅色
- [ ] 真机（android 深色）整体现象 = 墨黑 + 青柠硬边贴纸，无「模板 App 感」

---

## 九、与打包的衔接（给 P5）

- 品牌图标替换点：`src/static/app-icons/android/*` + `src/static/tabbar/*` 需换墨荧品牌图标（#C8F135 底 + 斜切角签名），再打正式包。
- 深色视觉真机回归以本文件 §八 为基准，逐条过。

---

## 十、样式分层架构（P6 全量优化新增，⚠️ 改样式前必读）

P6 之前样式是「一份 tokens.scss 被注入到每个页面」，踩了两个坑，现已改为**两层架构**，任何人后续加页面都必须遵守：

### 分层约定

| 文件 | 职责 | 是否含 CSS 规则 | 引入方式 |
|------|------|----------------|---------|
| `src/styles/tokens.scss` | **只放变量**：`:root{--bg-page; --accent; …}` | ❌ 不允许 | 由 `App.vue` 的 `<style lang="scss">` `@import` 一次 |
| `src/styles/global.scss` | **只放全局规则**：`page{}`、`.title-900`、`.tabular-nums`、`.sticker`、`.clip-tag` | ✅ 仅全局公共类 | 同上，紧跟 tokens 之后 |
| `src/pages/**/*.vue` 的 `<style lang="scss" scoped>` | 页面私有样式 | ✅ 页面自己的类 | **禁止再 `@import tokens`** |

- 入口固定为 `App.vue`：
  ```scss
  @import '@/styles/tokens.scss';
  @import '@/styles/global.scss';
  ```
- 变量是 `:root` 上的 CSS 自定义属性，靠**继承**生效 → `scoped` 页面同样能用 `var(--accent)`，**与 `<style>` 是否 `scoped`、是否写 `lang="scss"` 无关**（这两点不构成 token 可用的前提，别再据此批量改页面）。

### 已修掉的两个旧坑（勿回退）

1. **`vite.config.ts` 的 `additionalData` 必须留空**。
   旧配置 `additionalData: '@import "@/styles/tokens.scss"'` 会把 tokens **字符串拼接进每个页面的 `<style>`**，后果：
   - 全局规则（`page{}` / `.sticker` / `.clip-tag` …）被复制 20+ 份；
   - 在 `scoped` 下被加上 `[data-v-xxx]` 属性选择器 → 全局类**静默失效**；
   - 每页体积膨胀，H5 包成倍变大。
   现值为 `additionalData: ''` 并在行内注明原因，**不要「顺手恢复」**。

2. **`.tabular-nums` 不再带 `color: var(--accent)`**。
   旧版把数字类强行染成青柠，导致所有时间戳/计数都发光，直接违反 §八「每屏荧光焦点 ≤1」。现 `global.scss` 里的 `.tabular-nums` **只做 `font-variant-numeric: tabular-nums`**，颜色由使用处自行决定。

### 新增页面 checklist（补充 §八）

- [ ] `<style lang="scss" scoped>` 内**没有** `@import '@/styles/tokens.scss'`
- [ ] 只用 `var(--*)` 令牌，未硬编码 `#161B14` 之类的兜底 hex（旧代码曾用 `#161B14` 当 fallback，已全清）
- [ ] 颜色只用品牌令牌（可另加 `--secondary: #35e0c8`，**仅限语义状态色**：成功/在线/通过，不得作为第二主色）
