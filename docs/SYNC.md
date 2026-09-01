# 三方仓库同步（GitCode / GitHub / Gitee）

CampusHub 同时托管在三个平台。**同步方式：本地一次提交，手动推送三个远端**（不依赖任何 CI 密钥/自动化，简单可靠）。

| 平台 | 地址 | git 远端名 | 角色 |
|------|------|-----------|------|
| GitHub  | `github.com/Morningstar202604/campushub` | `github` | 主仓（source of truth）+ Issue/PR |
| GitCode | `gitcode.com/badhope/campushub` | `gitcode` | 镜像 |
| Gitee   | `gitee.com/badhope/campushub` | `origin` | 镜像（国内访问） |

## 一次性配置

```bash
git remote add gitee   https://gitee.com/badhope/campushub.git
git remote add gitcode https://gitcode.com/badhope/campushub.git
git remote add github  https://github.com/Morningstar202604/campushub.git
```

认证：`git config --global credential.helper store` 后首次 push 输入一次账号+令牌即可长期保存（令牌在各平台 Settings → 私人令牌/Token 生成）。

## 日常发布流程

```bash
# 1. 提交
git add -A && git commit -m "..."

# 2. 打版本标签（可选）
git tag -a v0.7.0 -m "v0.7.0"

# 3. 推送到三个平台（分支 + 标签）
git push origin main --follow-tags
git push gitcode main --follow-tags
git push github main --follow-tags
```

## 一行命令版

```bash
for r in origin gitcode github; do git push $r main --follow-tags; done
```

## 注意事项

- **不要 force-push**：除非你确切知道自己在做什么；三仓历史分叉时优先 `git pull --rebase` 对齐。
- 推送前跑一遍本地检查：`npm run doctor && npm run sync:common`。
- GitHub 上的 Actions 只做校验（CI）与手动部署，不做自动镜像——避免密钥泄漏与半同步状态。
