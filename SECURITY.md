# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Use [GitHub's private vulnerability reporting](https://github.com/Morningstar202604/campushub/security/advisories/new), or email the maintainer directly.
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

## UGC Compliance & Incident Response

CampusHub is a UGC (user-generated content) platform. Operators of every deployment
carry the following obligations, independent of the technical safeguards above:

### Operator obligations

1. **Subject qualification**: The "Social > Community/Forum" WeChat category requires a non-individual
   entity (organization / enterprise / individual business). Deployers must register the
   mini program under a qualifying subject and complete ICP filing.
2. **Real-name traceability**: End users are identified by `openid` and (optionally)
   campus verification. Operators must be able to map an `openid` to a real identity
   when legally required — keep registration logs; do not run fully anonymous deployments.
3. **Content retention**: Deleted content uses soft-delete (`status='deleted'`) and is
   preserved for traceability. Do not hard-delete records when handling regulator
   requests; export the relevant collections instead.
4. **Reporting channel**: The in-app report flow must stay enabled at all times.

### Incident response

| Scenario | Actions |
|----------|---------|
| Illegal/harmful content discovered | Delete via admin console → ban author if warranted → screenshot & archive evidence |
| Politically sensitive / fraud content | Above steps + report to campus authorities as required by local regulations |
| Regulator data request | Export relevant collections from CloudBase console; cooperate per applicable law |
| Moderation API outage | Users cannot publish (fail-closed). Announce downtime; **never** disable fail-closed to "temporarily" allow posting |

See [docs/OPERATIONS.md](./OPERATIONS.md) §3 for the day-to-day duty roster.

## Disclosure Policy

Once a vulnerability is fixed and released, we will publish a GitHub Security Advisory crediting the reporter (unless they prefer to remain anonymous).
