# Security Policy / 安全策略

## Supported Versions / 支持版本

| Version | Supported |
|---------|-----------|
| main (latest) | ✅ |
| 1.x (released) | ✅ |
| 0.x (legacy) | ❌ |

## Reporting a Vulnerability / 报告漏洞

**请勿在公开 issue 中提交安全漏洞**（Please do NOT report security vulnerabilities in public issues）。

如需报告安全问题，请通过以下方式之一私密提交（Please report privately via one of）：

- 在 GitHub 仓库创建 **Security Advisory**（推荐）：`https://github.com/X33834/campushub/security/advisories/new`
- 发送邮件至仓库维护者（via email to the maintainers，联系方式见仓库主页）

### 报告中请包含 / Please include in your report

1. 漏洞类型与影响范围（Type of vulnerability and impact scope）
2. 复现步骤（Steps to reproduce）
3. 受影响的版本（Affected versions）
4. 建议的修复方案（如果已有）（Suggested fix, if any）

### 处理承诺 / Our Commitment

- 我们会尽快确认并在 **7 天内**给出初步答复（We will acknowledge within 7 days）
- 修复前不会公开漏洞细节（Details stay private until fixed）
- 修复后会在 [CHANGELOG.md](CHANGELOG.md) 中记录（Fixed versions are noted in the changelog）

## Security Notes / 安全说明（如实标注）

- 当前图片存储为本地磁盘（`apps/server/uploads`），生产环境请挂载 OSS / CDN 并配置防盗链
- JWT access token 仅存内存（防 XSS 窃取），refresh token 持久化并支持轮换
- 管理后台由后端 `AdminGuard` 强制鉴权（401 / 403 / 封禁），前端菜单只是体验层
- 生产上线前请做安全加固（JWT 密钥强随机、HTTPS、限流）；机审 API / Sentry 为可选扩展，按需接入
