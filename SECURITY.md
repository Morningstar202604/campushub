# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Use [GitHub's private vulnerability reporting](https://github.com/weed33834/campushub/security/advisories/new), or email the maintainer directly.
3. Include a clear description of the vulnerability, steps to reproduce, and the potential impact.

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation within 14 days, depending on severity.

## Supported Versions

Only the latest release receives security updates.

> Note: CampusHub is mirrored across **GitCode**, **Gitee**, and **GitHub**, but **GitHub is the
> canonical source**. Please report security issues against the GitHub repository so they are
> tracked properly.

## Security Features

CampusHub is designed with the following security principles:

- **Trustworthy identity**: All user identity is derived from `cloud.getWXContext().OPENID` (platform-trustworthy, unforgeable). No client-supplied userId is trusted.
- **Centralized ban enforcement**: `requireActiveUser()` gates every write operation — no scattered checks, no bypass paths.
- **Fail-closed content moderation**: All UGC (text + images) goes through WeChat's `msgSecCheck` / `imgSecCheck`. Any API error (unavailable, over-quota, network, violation) results in rejection — content is never published unchecked.
- **Admin identity**: Cloud-verified via `checkAdmin()` (env var + DB config), never trusted from the client.
- **Ownership-scoped writes**: Deletion and editing are restricted to the content owner or an admin. User updates are locked by `openid` — no IDOR.
- **Safe search**: Keywords are regex-escaped and length-capped (20 chars), preventing ReDoS and regex injection.
- **Input validation**: All cloud functions validate and whitelist input parameters (types, status, lengths) to prevent injection and abuse.
- **Rate limiting**: Write operations (posts, comments, likes, follows, reports) are rate-limited via DB-backed counters.

## Disclosure Policy

Once a vulnerability is fixed and released, we will publish a GitHub Security Advisory crediting the reporter (unless they prefer to remain anonymous).
