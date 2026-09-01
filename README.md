# CampusHub

> **An open-source campus & interest content community built on WeChat Mini Program + CloudBase — a modern, open forum for campuses and interest groups.**
> Multi-level categories, posts, second-hand market, threaded comments, check-in streaks, follows, content moderation, and an admin console — ready out of the box, near-zero cost.
>
> 📖 [使用说明书](./docs/USER_GUIDE.md) ｜ 🇨🇳 [中文文档](./docs/README.zh-CN.md) ｜ 🇬🇧 [English](#overview) | 🌐 [Landing Page](https://Morningstar202604.github.io/campushub/)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.7.0-green.svg)](./CHANGELOG.md)
[![Cloud](https://img.shields.io/badge/WeChat-CloudBase-orange.svg)](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/Morningstar202604/campushub?style=social)](https://github.com/Morningstar202604/campushub)

> If this project helps you, please give it a ★ **Star** so more people can find it. Issues and [PRs](https://github.com/Morningstar202604/campushub/pulls) are welcome.
>
> **Search keywords**: wechat miniprogram open source / campus community / open-source forum / second-hand market mini program / cloudbase / tieba-style / student marketplace / WeChat Mini Program forum.

---

## Overview

CampusHub is a campus content platform built on **WeChat Mini Program + WeChat CloudBase**. It follows a **one-school-per-deployment** model: users post, ask questions, trade, and connect under a **multi-level category tree**.

- Content **defaults to your own campus** — deploy one environment per school.
- The category tree (Zone → Category → Board, 3 levels) is **managed via admin UI** — no code changes or redeployment needed to add a school or open a new category.
- Task-type posts support **auto-expiry** and **resolved marking**, keeping the feed clean.

## Features

| Feature | Description |
|---------|-------------|
| **Multi-level Categories** | Zone → Category → Board (3-tier); `categoryPath` ancestor array enables filtering by any parent node; posts restricted to leaf nodes |
| **Feed Homepage** | Waterfall layout for posts + products; Recommend / Latest / Second-hand tabs; category filter + expired archive entry |
| **Rich Posts** | Image + text posts, categories, tags, anonymous posting, drafts, image preview |
| **Task & Expiry** | Task posts with 3/7/15/30-day TTL; 6-hourly cron scan auto-archives expired tasks; author/admin can mark "resolved" |
| **Second-hand Market** | Product listings with price, condition, trade type, contact info; mark as sold; edit listings |
| **Nested Comments** | Threaded replies (floors + sub-replies), comment likes, reply-to-user |
| **Follow System** | Follow/unfollow users, follower/following counts, user profile pages |
| **Daily Check-in** | Consecutive check-in streak + credit points with weekly bonus |
| **In-app Notifications** | Auto-generated notifications for likes, comments, and follows |
| **Campus Guides** | Curated articles (freshman guide, study tips, etc.) with category filter |
| **Search** | Cross-collection search (posts + products + guides) with title + content matching and keyword highlighting |
| **User Profiles** | Public profile page with stats, recent posts, follow button |
| **Content Safety** | All UGC goes through WeChat's `msgSecCheck` + `imgSecCheck` — **fail-closed** (any error = reject) |
| **Admin Console** | Report review, ban/unban, pin/essence posts, user list, feedback management, category CRUD, announcement management, operation audit logs |
| **Category Management** | Admin UI for adding schools, categories, boards — pure operational action, no code changes |
| **Announcements** | Admin-published notices shown at the top of the homepage (≤3, pinned first) |
| **Points Mall** | Redeem check-in points for rename tokens (first nickname change is free) |
| **Auto Backup** | Daily 03:00 scheduled snapshot of core collections into `backups` (7-day retention) |
| **Admin Audit Logs** | Sensitive admin actions (ban/delete/pin/verify...) written to `admin_logs`, viewable in console |
| **Post Poster** | One-tap Canvas share card with title/summary/author, saved to photo album |
| **Search Rate-limit + Hot Words** | Server-side per-user rate limit (10s/3) + real hot queries aggregated from last 7 days |
| **Cursor Pagination** | Latest-post feed & comments use cursor-based pagination for deep scroll efficiency |

## Tech Stack

- **Frontend**: Native WeChat Mini Program (WebView rendering)
- **UI Components**: TDesign Mini Program component library
- **Backend**: WeChat CloudBase (Cloud Functions + Cloud Database + Cloud Storage)
- **Architecture**: `cloudfunctions/common/` shared kernel layer — single source of truth for auth, content safety, ban enforcement, rate limiting, response format, content deletion, and index definitions

## Project Stats

| Metric | Count |
|--------|-------|
| Cloud Functions | 37 |
| Mini Program Pages | 22 |
| Database Collections | 21 |
| Defined Indexes | 41 |
| Cloud Function Common Modules | 9 (synced to all 34 functions) |

## Directory Structure

```
CampusHub/
├── miniprogram/              # Mini Program frontend
│   ├── app.js               # Entry (CloudBase init)
│   ├── app.json             # Global config
│   ├── app.wxss             # Global styles + Design Tokens
│   ├── pages/               # 23 pages
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
│   └── SYNC.md              # Three-platform manual sync guide
├── docs/
│   ├── DEPLOY.md             # ★ Deployment guide (10 steps)
│   ├── INDEXES.md           # ★ Database index checklist (36 indexes)
│   └── SYNC.md              # Three-platform sync instructions
├── .github/
│   ├── workflows/
│   │   ├── ci.yml            # CI: JSON validity + JS syntax + common-layer consistency
│   │   └── deploy.yml        # Manual cloud-function deploy (workflow_dispatch)
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

This copies the 9 common files into all 34 cloud function directories, ensuring "one source, zero drift."

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
- **Near-zero cost**: CloudBase free-trial env for dev, 19.9 CNY/mo entry plan in production

## Roadmap

- [x] Admin console (ban/review/pin/essence)
- [x] Image content safety (`imgSecCheck`)
- [x] Multi-level categories + admin CRUD
- [x] Task expiry & resolved marking
- [x] Nested comments (threaded replies) + comment likes
- [x] Follow system + user profiles
- [x] Daily check-in + credit points
- [x] In-app notifications
- [x] Post/product editing
- [x] Draft auto-save
- [x] One-command cloud function deploy (`npm run deploy` + GitHub Actions + `npm run doctor` self-check)
- [x] Cost pack: upload image compression, feed/category TTL cache, lazy task expiry, search throttle
- [x] Dedicated second-hand market tab page
- [x] Confession wall (forced-anonymous short posts)
- [x] Hot ranking tab (last-7-day likes)
- [x] Subscribe message framework (env-configurable templates)
- [x] Lost & found module (kind=lost/found + dedicated page)
- [x] Campus identity verification (student-ID + card photo, admin review)
- [ ] Self-hosted backend migration (Node.js + PostgreSQL)
- [x] Real-time push via subscribe messages (framework; enable by setting TMPL_* env vars)
- [ ] Campus events module
- [ ] Multi-language UI (i18n)

> Strategy & expert review: see [`docs/EXPERT_REVIEW_AND_ROADMAP.md`](./docs/EXPERT_REVIEW_AND_ROADMAP.md)

## Mirrors & Sync

This project is open-sourced under **Apache License 2.0** and mirrored across three platforms:

| Platform | URL | Role |
|----------|-----|------|
| **GitHub** | [github.com/Morningstar202604/campushub](https://github.com/Morningstar202604/campushub) | Canonical source |
| **GitCode** | [gitcode.com/badhope/campushub](https://gitcode.com/badhope/campushub) | Mirror |
| **Gitee** | [gitee.com/badhope/campushub](https://gitee.com/badhope/campushub) | Mirror (China access) |

Sync is manual by design: commit once locally, push to all three remotes — see [`docs/SYNC.md`](./docs/SYNC.md).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, code style, and PR process.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

**Latest: v0.7.0** — Lost & found, confession wall, hot ranking, campus verification, subscribe-message framework; v0.6.1 security audit fixes (fail-closed images, idempotent likes/checkin, atomic deletes). See [CHANGELOG](./CHANGELOG.md).

## License

[Apache License 2.0](./LICENSE) © 2026 Morningstar202604. See [NOTICE](./NOTICE) for details.
