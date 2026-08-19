# CampusHub

> **基于「微信小程序 + 云开发」的开源校园 / 兴趣内容社区 —— 一个新时代的开源贴吧。**
> 多级分类、发帖、二手交易、楼中楼评论、签到、关注、内容安全、管理后台，开箱即用、零成本。
>
> 🇨🇳 [中文文档](./docs/README.zh-CN.md) ｜ 🇬🇧 [English](#overview) ｜ 🌐 [官网 Landing Page](https://weed33834.github.io/campushub/)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.6.0-green.svg)](./CHANGELOG.md)
[![Cloud](https://img.shields.io/badge/WeChat-CloudBase-orange.svg)](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/weed33834/campushub?style=social)](https://github.com/weed33834/campushub)

> 如果这个项目对你有帮助，欢迎点击右上角 ★ **Star** 支持一下，让更多人能检索到它。也欢迎提 [Issue](https://github.com/weed33834/campushub/issues) 与 [PR](https://github.com/weed33834/campushub/pulls)。
>
> **搜索关键词**：微信小程序开源 / 校园社区开源 / 开源贴吧 / 校园论坛 / 二手交易小程序 / 云开发开源 / 微信小程序论坛 / 兴趣社区 / Tieba-style / WeChat Mini Program forum / open-source community.

---

## Overview

CampusHub is a content community built on **WeChat Mini Program + WeChat CloudBase**. Think of it as a modern, open-source Tieba (贴吧): users can post, ask questions, trade, and connect with like-minded people under a **multi-level category tree**.

- Content is **nationwide by default** — not locked to a single campus.
- The category tree (Zone → Forum → Board, 3 levels) is **managed via admin UI** — no code changes or redeployment needed to add a school or open a new forum.
- Task-type posts support **auto-expiry** and **resolved marking**, keeping the feed clean.

## Features

| Feature | Description |
|---------|-------------|
| **Multi-level Categories** | Zone → Forum → Board (3-tier); `categoryPath` ancestor array enables filtering by any parent node; posts restricted to leaf nodes |
| **Feed Homepage** | Waterfall layout for posts + products; Recommend / Latest / Second-hand tabs; category filter + expired archive entry |
| **Rich Posts** | Image + text posts, categories, tags, anonymous posting, drafts, image preview |
| **Task & Expiry** | Task posts with 3/7/15/30-day TTL; hourly cron scan auto-archives expired tasks; author/admin can mark "resolved" |
| **Second-hand Market** | Product listings with price, condition, trade type, contact info; mark as sold; edit listings |
| **Nested Comments** | Threaded replies (楼中楼), comment likes, reply-to-user |
| **Follow System** | Follow/unfollow users, follower/following counts, user profile pages |
| **Daily Check-in** | Consecutive check-in streak + credit points with weekly bonus |
| **In-app Notifications** | Auto-generated notifications for likes, comments, and follows |
| **Campus Guides** | Curated articles (freshman guide, study tips, etc.) with category filter |
| **Search** | Cross-collection search (posts + products + guides) with title + content matching and keyword highlighting |
| **User Profiles** | Public profile page with stats, recent posts, follow button |
| **Content Safety** | All UGC goes through WeChat's `msgSecCheck` + `imgSecCheck` — **fail-closed** (any error = reject) |
| **Admin Console** | Report review, ban/unban, pin/essence posts, user list, feedback management, category CRUD |
| **Category Management** | Admin UI for adding schools, forums, boards — pure operational action, no code changes |

## Tech Stack

- **Frontend**: Native WeChat Mini Program (WebView rendering)
- **UI Components**: TDesign Mini Program component library
- **Backend**: WeChat CloudBase (Cloud Functions + Cloud Database + Cloud Storage)
- **Architecture**: `cloudfunctions/common/` shared kernel layer — single source of truth for auth, content safety, ban enforcement, rate limiting, response format, content deletion, and index definitions

## Project Stats

| Metric | Count |
|--------|-------|
| Cloud Functions | 34 |
| Mini Program Pages | 19 |
| Database Collections | 14 |
| Defined Indexes | 32 |
| Cloud Function Common Modules | 8 (synced to all 34 functions) |

## Directory Structure

```
CampusHub/
├── miniprogram/              # Mini Program frontend
│   ├── app.js               # Entry (CloudBase init)
│   ├── app.json             # Global config
│   ├── app.wxss             # Global styles + Design Tokens
│   ├── pages/               # 19 pages
│   ├── components/          # Shared components (category-picker)
│   └── utils/               # Utilities (request, auth)
├── cloudfunctions/           # 34 cloud functions
│   ├── common/              # ★ Shared kernel layer (single source of truth)
│   │   ├── common-db.js      # Cloud SDK singleton & DB access
│   │   ├── common-error.js   # Unified error model + wrap()
│   │   ├── common-context.js # User context & auth (requireActiveUser)
│   │   ├── common-security.js# fail-closed content safety + checkAdmin
│   │   ├── common-rate.js    # Rate limiting
│   │   ├── common-content.js # Content deletion (soft-delete + image recycle + counter rollback)
│   │   ├── common-indexes.js # ★ Index definitions (single source of truth)
│   │   └── common-bundle.js  # One-line aggregator export
│   ├── post-create/          # Create post (leaf-node validation + task expiry)
│   ├── post-update/          # Edit post (owner only, fail-closed safety)
│   ├── post-list/            # Post listing (category/status filter)
│   ├── post-detail/          # Post detail + view count + like/collect status
│   ├── post-delete/          # Delete post (owner/admin)
│   ├── product-create/       # Create product (NaN-safe price + safety)
│   ├── product-update/       # Edit product + mark sold/relite
│   ├── product-list/         # Product listing
│   ├── product-detail/       # Product detail + view count
│   ├── product-delete/       # Delete product (owner/admin)
│   ├── comment-create/       # Create comment (nested replies + target status check)
│   ├── comment-list/         # Comment list (threaded: floors + sub-replies)
│   ├── comment-delete/       # Delete comment (owner/admin)
│   ├── like/                 # Like/unlike (posts + products + comments)
│   ├── collect/              # Collect/uncollect + user count sync
│   ├── follow/               # Follow/unfollow + lists + status check
│   ├── checkin/              # Daily check-in + streak + points
│   ├── notification/         # In-app notifications (list/read/unread)
│   ├── report/               # Report content (dedup + type whitelist)
│   ├── feedback-create/      # Submit feedback (content safety)
│   ├── search/               # Cross-collection search (title + content, dedup)
│   ├── my-list/              # User's own posts/products/collects
│   ├── category-list/        # Category tree (by parentId drill-down)
│   ├── category-manage/      # Category CRUD (admin, anti-cycle, level cascade)
│   ├── guide-list/           # Guide list (paginated)
│   ├── guide-detail/         # Guide detail (status-filtered)
│   ├── admin/                # Admin hub (ban/unban/reports/pin/essence/users/feedbacks)
│   ├── resolve/              # Mark task resolved (author/admin)
│   ├── task-expire/          # Hourly cron: expire overdue unresolved tasks
│   ├── user-update/          # Update profile (avatar safety + field validation)
│   ├── user-profile/         # View other user's profile
│   ├── login/                # Login/register (openid-based)
│   └── init-db/              # One-time DB bootstrap (collections + seeds + index check)
├── scripts/
│   ├── sync-common.js       # Sync common/ into every cloud function directory
│   └── sync-mirrors.sh      # Three-platform mirror sync (GitCode/GitHub/Gitee)
├── docs/
│   ├── DEPLOY.md             # ★ Deployment guide (10 steps)
│   ├── INDEXES.md           # ★ Database index checklist (32 indexes)
│   └── SYNC.md              # Three-platform sync instructions
├── .github/
│   ├── workflows/
│   │   ├── ci.yml            # CI: validate all cloud function package.json
│   │   ├── mirror.yml        # Auto-mirror GitHub → GitCode + Gitee
│   │   └── dependabot-auto-merge.yml
│   └── dependabot.yml
├── project.config.json      # WeChat DevTools project config (fill your AppID)
├── package.json             # npm deps + sync:common script + OSS metadata
├── LICENSE                  # Apache License 2.0
├── NOTICE                   # Apache NOTICE
├── CODE_OF_CONDUCT.md       # Contributor Covenant 2.1
├── CONTRIBUTING.md          # Contribution guide
├── SECURITY.md              # Security vulnerability reporting
└── CHANGELOG.md             # Version history
```

## Architecture: Shared Kernel Layer

All cloud functions share a single kernel for auth, content safety, ban enforcement, rate limiting, response format, content deletion, and index definitions — all in `cloudfunctions/common/`.

Each function imports it with one line:

```js
const { getDB, ok, wrap, requireActiveUser, checkContents, rateLimit, removeContent, checkAdmin } = require('./common-bundle')
```

Before deploying, run the sync script (also auto-triggered by `npm install` via `prepublishOnly`):

```bash
npm run sync:common
```

This copies the 8 common files into all 34 cloud function directories, ensuring "one source, zero drift."

## Quick Start

> **Full deployment guide: [`docs/DEPLOY.md`](./docs/DEPLOY.md)** — 10 steps from AppID to production.

```bash
# 1. Install deps (auto-syncs common layer)
npm install

# 2. Build npm in WeChat DevTools (Tools → Build npm)

# 3. Fill in your AppID in project.config.json
# 4. Fill in your CloudBase env ID in miniprogram/app.js
# 5. Deploy all 34 cloud functions (right-click each → Upload & Deploy)
# 6. Configure admin OpenID (cloud function env var: ADMIN_OPENIDS)
# 7. Call init-db cloud function once (creates collections + seeds + index check)
# 8. Create 32 database indexes manually in CloudBase console
# 9. Preview & test
# 10. Upload → Submit for review → Publish
```

## Design Principles

- **Anonymous posting**: Posts/comments can be anonymous; products cannot (trust isolation)
- **Fail-closed content safety**: Any content safety API error (unavailable/over-quota/violation) → reject publish, never let content through unchecked
- **Centralized ban enforcement**: `requireActiveUser()` gates all write operations — no scattered checks
- **Single source for deletion**: `removeContent()` handles soft-delete + cloud storage image recycle + counter rollback + admin override
- **Multi-level category filtering**: `categoryPath` ancestor array — one index covers filtering at any tree depth
- **Task expiry & resolution**: `task-expire` cron excludes resolved tasks; `resolve` checks post status
- **Index self-check**: `init-db` compares `common-indexes.js` against live indexes and reports `missingIndexes`
- **Soft delete**: Deletion sets `status='deleted'`, preserving data traceability; counters sync-rollback
- **Safe search**: Regex-escaped keywords + 20-char limit, no ReDoS/injection
- **Zero cost**: CloudBase free tier is sufficient for ~1000 DAU MVP

## Roadmap

- [x] Admin console (ban/review/pin/essence)
- [x] Image content safety (`imgSecCheck`)
- [x] Multi-level categories + admin CRUD
- [x] Task expiry & resolved marking
- [x] Nested comments (楼中楼) + comment likes
- [x] Follow system + user profiles
- [x] Daily check-in + credit points
- [x] In-app notifications
- [x] Post/product editing
- [x] Draft auto-save
- [ ] Content recommendation / hot ranking
- [ ] Self-hosted backend migration (Node.js + PostgreSQL)
- [ ] Real-time push notifications (WeChat subscribe messages)
- [ ] Campus events module
- [ ] Multi-language UI (i18n)

## Mirrors & Sync

This project is open-sourced under **Apache License 2.0** and mirrored across three platforms:

| Platform | URL | Role |
|----------|-----|------|
| **GitCode** | [gitcode.com/badhope/campushub](https://gitcode.com/badhope/campushub) | Canonical source |
| **GitHub** | [github.com/weed33834/campushub](https://github.com/weed33834/campushub) | Mirror + CI + Issues |
| **Gitee** | [gitee.com/badhope/campushub](https://gitee.com/badhope/campushub) | Mirror (China access) |

GitHub Actions (`.github/workflows/mirror.yml`) auto-mirrors pushes to GitCode + Gitee.
For local sync, use `scripts/sync-mirrors.sh`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, code style, and PR process.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

**Latest: v0.6.0** — Follow system, check-in, nested comments, comment likes, user profiles, in-app notifications, post/product editing, admin pin/essence UI, 12 critical bug fixes, security hardening.

## License

[Apache License 2.0](./LICENSE) © 2026 weed33834. See [NOTICE](./NOTICE) for details.
