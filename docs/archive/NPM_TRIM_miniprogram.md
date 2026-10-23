# 小程序 npm 包瘦身待验证清单（NPM_TRIM）

> 档位2 架构去重改造② 的配套清单。
> **本清单是"给用户执行的待验证方案"，不是已执行的删除。** 历史教训：`git log` 里踩过
> "tdesign 产物平铺缺包名层 → 真机组件全部白屏"的坑，因此**任何人都不要直接删文件**，
> 务必按下述步骤在微信开发者工具真机验证通过后，再提交。
> 基线日期：2026-09-21；基线 commit 之上的变更。

---

## 一、当前事实（本次实查结论）

`miniprogram/miniprogram_npm/` 已被 **出库**（`.gitignore` 忽略 + `git rm -r --cached`），
克隆后需先用「微信开发者工具 → 工具 → 构建 npm」生成（见 `docs/DEPLOY.md` 第三步）。

该目录约 **4.3MB / 1208 文件**，构成：

| 目录 | 大小 | 说明 |
|------|------|------|
| `tdesign-miniprogram/`（全量 75 个组件子包 + 根文件） | ~3.5MB | 组件库全量，但**前端实际只用到 25 个组件** |
| `dayjs/` | ~800K | 见第三节"已证实零引用，可直接删" |

---

## 二、tdesign 组件：真实使用面（纠正"只用了 button"的旧判断）

实查 `miniprogram/**/*.wxml`（排除 `miniprogram_npm`）中真正出现的 `<t-*>` 组件共 **25 个**：

```
avatar   badge    button    cell      checkbox      checkbox-group
draggable*  grid    grid-item  icon    image      link
loading    message-item  overlay  picker   picker-item  popup
radio      radio-group  side-bar   side-bar-item  sticky
swiper-nav tab-panel  tabs
```

> ⚠️ **重要**：`docs/OPTIMIZATION_PLAN.md` 等旧材料里"前端实际只用了 `t-button`"的判断**不准确**。
> 真实使用面是上表 25 个组件（外加 `draggable` 需确认，见下）。
> 因此"删掉 77 个未用子包"**不能按"只留 button"** 来做——那样会删掉 24 个在用的组件，必然白屏。

`draggable`：`<t-draggable>` 在 wxml 中被引用，但 `tdesign-miniprogram/` 下没有同名子包目录。
两种可能：① 是 tdesign 内部组件/通过别名注册；② 是自定义组件或残留引用。
**动手瘦身前必须先确认它到底怎么来的**（grep 页面 json 的 `usingComponents`、以及是否有本地自定义组件），
若发现是死引用可顺带清理，但**不要在未确认前删任何东西**。

---

## 三、依赖链（务必保留）

`button` 等组件运行时依赖 tdesign 的 `common` / `mixins` / `transition` 等公共层：

```
common、mixins、transition  ← 公共依赖层，绝不可删
button/icon/loading/badge/overlay/...  ← 在用组件 + 其传递依赖
```

估算：`button`(85K) + `icon`(98K) 及其公共依赖链，**完整保留集远大于 85K**（25 个组件 + 公共层合计约 1~2MB 量级）。
**不要按"只留 85K"这种估算去删**，必须以"实际使用面 + 传递依赖"为准。

---

## 四、可安全删除的候选（未用子包，49 个）

下面 49 个子包在 `miniprogram/**/*.wxml` 中**零引用**（且非公共层 `common`/`mixins`/`index*`/`indexes`），
**理论上**可删。但删除后必须真机验证（第五节）：

```
action-sheet  avatar-group  back-top  calendar  cascader
cell-group  check-tag  col  collapse  collapse-panel  color-picker
count-down  date-time-picker  dialog  divider  drawer
dropdown-item  dropdown-menu  empty  fab  footer  guide
image-viewer  indexes-anchor  input  message  navbar  notice-bar
progress  pull-down-refresh  rate  result  row  search
skeleton  slider  step-item  stepper  steps  swipe-cell  swiper
switch  tab-bar  tab-bar-item  tag  textarea  toast  tree-select  upload
```

> 再次强调：以上 49 个是"零 wxml 引用"，但**可能通过 JS 动态 `createSelectorQuery` / 注册表被内部引用**。
> 删除前建议在代码库全局 grep 每个组件名（`miniprogram/**/*.js`），确认无动态引用再删。

---

## 五、验证方法（必须执行，防止白屏回归）

1. **备份**：`cp -r miniprogram/miniprogram_npm miniprogram/miniprogram_npm.bak`
2. 删除上节 49 个候选子包（**保留**：common/mixins/transition/根 index/indexes + 第二节 25 个在用组件）
3. 微信开发者工具 → 「工具 → 构建 npm」（重新生成干净产物）
4. `npm run verify` 校验产物结构（确认 `tdesign-miniprogram/<组件>/` 包名层完整）
5. **真机预览**（不是模拟器）：依次走
   - 首页瀑布流（t-image/t-icon/t-badge/t-loading 渲染）
   - 发布/二手详情（t-button/t-cell/t-popup/t-switch 等）
   - 二手网格（t-grid/t-grid-item）、指南（t-sticky/t-side-bar）
   - 表单（t-input 已删？若删了发布页输入框会白屏——重点验）
   - 选择类（t-picker/t-radio/t-checkbox）
6. 任一环白屏 / 组件不渲染 → **立即 `rm -rf miniprogram/miniprogram_npm && cp -r .bak .` 回滚**，缩小删除范围逐批验证
7. 全绿后再删除 `.bak`，提交瘦身结果

> ⚠️ 特别注意 `input`：候选表里有 `input`，但发布/编辑表单若真的用到 `<t-input>` 就**不能删**。
> 第二节 wxml 扫描没命中 `<t-input`，但请再用 `<t-input`（可能写作 `<t-input` 或 `t-input`）全局确认一次。

---

## 六、dayjs（已证实零引用，可直接删）

实查命令（本次已执行）：

```bash
grep -rn "require('dayjs')\|from 'dayjs'\|require(\"dayjs\")\|from \"dayjs\"" miniprogram/ --include=*.js | grep -v miniprogram_npm
# 结果：0 命中
```

- `miniprogram_npm/dayjs/`（~800K）是构建 tdesign 时随包带出的，**前端业务代码未直接 require**。
- 前端时间格式化走的是 `utils` 里已有的 `formatTime`（[auth.js] 等），不依赖 dayjs。
- **结论：dayjs 800K 冗余，可在第五节验证流程里一并删除 `miniprogram/miniprogram_npm/dayjs/`。**
- 唯一风险：若某天有人升级 tdesign 版本导致其内部组件强依赖 dayjs（极少见），真机预览会暴露。按第五节流程验证即可。

---

## 七、给"下次执行瘦身"的人的一句话

**别删了直接提**。正确姿势：删 49 候选子包 + dayjs → 重新「构建 npm」→ `npm run verify` → 真机预览 6 条主流程 → 全绿才提交。
历史白屏的根因是"产物包名层被破坏"，`verify` 就是为你兜底那道闸。
