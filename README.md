# 韩师校园通 (CampusHub)

> 面向韩山师范学院师生的校园信息服务平台

## 功能模块

- **首页信息流**：帖子 + 商品瀑布流，推荐/最新/二手 Tab 切换
- **贴吧式发帖**：支持图文帖子、分类、标签、匿名发布
- **二手交易**：商品发布、分类筛选、联系方式展示（纯信息展示，不做担保交易）
- **校园指南**：新生入学、学习攻略、生活指南等分类指南
- **搜索**：全站搜索帖子、商品、指南
- **个人中心**：资料管理、我的发布、收藏、反馈

## 技术栈

- **前端**：原生微信小程序 + Skyline 渲染引擎
- **UI 组件**：TDesign 微信小程序组件库
- **后端**：微信云开发（云函数 + 云数据库 + 云存储）
- **设计**：自定义 CSS Token 系统，青春校园蓝主色系

## 目录结构

```
campushub/
├── miniprogram/              # 小程序前端
│   ├── app.js               # 应用入口
│   ├── app.json             # 全局配置
│   ├── app.wxss             # 全局样式 + Design Token
│   ├── pages/               # 页面
│   │   ├── index/           # 首页（信息流瀑布流）
│   │   ├── login/           # 登录页
│   │   ├── post-publish/    # 发帖页
│   │   ├── post-detail/     # 帖子详情+评论
│   │   ├── product-publish/ # 商品发布
│   │   ├── product-detail/  # 商品详情
│   │   ├── guide/           # 校园指南列表
│   │   ├── guide-detail/    # 指南详情
│   │   ├── search/          # 搜索
│   │   ├── profile/         # 个人中心
│   │   ├── profile-edit/    # 编辑资料
│   │   ├── my-list/         # 我的发布/收藏
│   │   ├── feedback/        # 意见反馈
│   │   └── agreement/       # 用户协议
│   └── utils/               # 工具函数
│       ├── request.js       # 云函数调用封装
│       ├── auth.js          # 登录态管理
│       └── format.js        # 格式化工具
├── cloudfunctions/           # 云函数
│   ├── login/               # 用户登录
│   ├── post-list/           # 帖子列表
│   ├── post-create/         # 创建帖子
│   ├── post-detail/         # 帖子详情
│   ├── product-list/        # 商品列表
│   ├── product-create/      # 创建商品
│   ├── product-detail/      # 商品详情
│   ├── comment-list/        # 评论列表
│   ├── comment-create/      # 创建评论
│   ├── like/                # 点赞/取消
│   ├── collect/             # 收藏/取消
│   ├── guide-list/          # 指南列表
│   ├── guide-detail/        # 指南详情
│   ├── search/              # 全站搜索
│   ├── user-update/         # 更新用户信息
│   ├── my-list/             # 我的列表
│   └── report/              # 举报
├── scripts/                  # 脚本
│   └── init-guide-data.js   # 校园指南初始数据
├── project.config.json      # 项目配置
└── package.json             # npm 依赖
```

## 快速开始

### 1. 安装依赖

```bash
cd campushub
npm install
```

### 2. 构建npm

在微信开发者工具中：
- 菜单 → 工具 → 构建npm

### 3. 配置云开发

1. 在微信开发者工具中开通云开发
2. 创建云环境（如 `campushub`）
3. 修改 `app.js` 中的 `env` 为你的云环境ID
4. 上传部署所有云函数

### 4. 创建数据库集合

在云开发控制台创建以下集合：
- `users` — 用户
- `posts` — 帖子
- `products` — 商品
- `comments` — 评论
- `likes` — 点赞
- `collects` — 收藏
- `guides` — 校园指南
- `guide_categories` — 指南分类
- `reports` — 举报
- `feedbacks` — 反馈

### 5. 设置数据库权限

所有集合权限设置为：**仅创建者可读写**（或按需调整）

### 6. 初始化指南数据

运行 `scripts/init-guide-data.js` 中的数据导入到 `guides` 和 `guide_categories` 集合

## 设计要点

- **匿名机制**：帖子/评论可匿名，商品不可匿名（信任隔离）
- **信息层次**：首页瀑布流双列布局，卡片式设计，视觉层次清晰
- **安全合规**：敏感词检查（微信内容安全API）、频率限制、举报机制
- **零成本**：云开发免费额度足够1000日活MVP阶段使用

## 后续规划

- [ ] 支付/佣金功能（预留接口）
- [ ] 多校扩展
- [ ] 自建后端迁移（Node.js + MongoDB/PostgreSQL）
- [ ] 实时消息通知
- [ ] 校园活动模块
