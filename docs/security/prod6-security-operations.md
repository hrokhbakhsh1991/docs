# PROD-6 Security Operations

Status: release-candidate control document for PROD-6.

## Threat model

| Surface | Trust boundary | Primary assets | Required controls |
| --- | --- | --- | --- |
| Admin | Operator browser to Admin BFF and API | operator sessions, workspace settings, bookings, finance records | host binding, cookie-only platform session isolation, JWT verification, CSRF posture on cookie mutations, log redaction |
| API | Public HTTP ingress, internal route ingress, database, Redis, object storage | tenant data, platform operations, tokens, uploads, audit logs | trusted-host enforcement, bearer parsing precedence, service JWT on internal routes, production auth fail-closed, storage/Redis production guards |
| Portal | Member browser to Portal BFF and API | member sessions, registrations, profile data | portal host binding, member-session authority, public-auth CORS allowlist, logout cookie clearing parity |
| Marketing | Anonymous public browser to marketing front door | public catalog, workspace brand assets | host binding, anonymous-only session posture, remote image host allowlist, browser security headers |
| Object storage | API to MinIO/S3-compatible bucket | booking receipts and uploads | MIME and size limits before storage, tenant-scoped object keys, signed URL mediation, no client MinIO SDK bundle |
| Database | API runtime to PostgreSQL | tenant and platform records | migration checksum preflight, RLS/tenant isolation tests where PostgreSQL is available, production boot requires DB URL |
| Redis | API runtime cache/session adjunct | rate-limit and cache data | production boot requires Redis URL; local memory fallback is development/test only |
| VPS deploy | GitHub Actions to VPS over SSH | release artifact, service units, environment files | required release checks, known-host SSH, deploy key in repository secrets only, no production fallback credentials |

## Route inventory

| Class | Evidence | Policy |
| --- | --- | --- |
| Public | Admin/Portal/Marketing public-auth and host-bind tests; API public-auth and phone-login tests | public routes may not mint privileged sessions without tenant/host validation |
| Authenticated | Admin login/session, Portal public-auth session, API identity JWT signing and bearer tests | authenticated routes require session/JWT validation and tenant binding |
| Internal | API internal cache invalidation and correlation tests | internal routes require service JWT or non-public ingress control |
| Platform-admin | platform ops auth, platform auth session, DB role, and production auth harness tests | platform-admin access fails closed without explicit configured credentials |

## CSRF and browser headers

Cookie-authenticated browser mutations are mediated through same-site BFF/session boundaries and host binding tests. Admin, Portal, and Marketing must publish the Next security-header set guarded by `pnpm run prod6:security-headers`.

Required browser headers:

- `Content-Security-Policy`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`

## Dependency and vulnerability policy

Runtime dependency ownership sits with the release owner for the package being shipped. The PROD-6 release gate blocks on any production dependency audit result at `critical` or `high` severity unless there is a signed, expiring exception recorded in the execution plan.

Cadence:

- Weekly dependency review for production packages.
- Same-day review for critical/high advisories affecting reachable runtime dependencies.
- Lockfile SBOM generated for each release candidate by `pnpm run prod6:release-evidence`.

Current production dependency review:

- `pnpm run prod6:supply-chain:audit` enforces zero critical/high production advisories.
- `pnpm run prod6:security-release` ties the audit to secret scans, static security, GitHub Action policy, SBOM, and checksum evidence.

## Security reporting

Report vulnerabilities to the repository owner through the private project channel or a private GitHub security advisory. Do not open public issues containing exploit details, secrets, tokens, tenant data, logs, or screenshots with PII.

Triage expectations:

- Critical/high reports: acknowledge within one business day.
- Medium/low reports: acknowledge within five business days.
- Every accepted exception must include owner, scope, expiry date, and compensating controls.

## Secret ownership and rotation

Production secrets must live in the deployment provider or GitHub repository/environment secrets, not in tracked files, generated artifacts, logs, or shell history.

| Secret family | Owner | Storage | Rotation and revocation |
| --- | --- | --- | --- |
| JWT signing keys | API/release owner | production environment secret store | rotate by publishing current and previous public keys, deploy overlap, then remove expired previous key after validation |
| Platform ops bearer token | platform/release owner | production environment secret store | rotate by replacing secret, redeploying, and confirming old token fails |
| Database URL | infrastructure owner | production environment secret store | rotate database credential, update secret, restart API, revoke old credential |
| Redis URL | infrastructure owner | production environment secret store | rotate Redis credential/endpoint, update secret, restart API, revoke old credential |
| Object storage credentials | infrastructure owner | production environment secret store | rotate access key, update API secret, confirm signed URL flow, revoke old key |
| VPS SSH deploy key | infrastructure owner | GitHub repository or environment secret | restrict to the deploy account, use known hosts, rotate by adding replacement key, validating deploy, then removing old key |

## Release evidence status

`pnpm run prod6:release-evidence` writes checksums and SHA-tied evidence for the current checkout. A dirty checkout may produce local readiness evidence, but a signed release attestation requires a clean release candidate SHA and the configured signing system.
