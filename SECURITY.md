# Security Policy

## Reporting a vulnerability

Please report security issues privately through the repository owner or a private GitHub security advisory. Do not open a public issue containing exploit details, secrets, tokens, tenant data, logs, screenshots with PII, or production endpoint details.

Expected acknowledgement:

- Critical or high severity: within one business day.
- Medium or low severity: within five business days.

Accepted exceptions must be explicit, signed by the release owner, scoped to a finding, and include an expiry date plus compensating controls.

## Release security controls

PROD-6 release evidence is produced by:

```bash
pnpm run prod6:security-release
```

That gate includes tracked-tip and history-aware secret scans, production dependency audit policy, browser security-header checks, static security checks, GitHub Action/deploy dependency policy, and SHA-tied release evidence.
