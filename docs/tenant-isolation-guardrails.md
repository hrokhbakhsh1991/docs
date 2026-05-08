# Tenant isolation — automated guardrails

CI runs **`scripts/check-tenant-isolation-guardrails.mjs`** (see `.github/workflows/architecture-guardrails.yml`) to reduce accidental **tenant isolation regressions**.

## What is enforced

| Check | Intent |
|--------|--------|
| **`dataSource.query`** | Raw SQL bypasses TypeORM + tenant session binding (`SET LOCAL app.tenant_id`). Only explicitly allowlisted runtime files may call `dataSource.query`. |
| **`@Body()` + `tenant_id`** | Request DTO classes that expose **`tenant_id`** must not be accepted from the client unless allowlisted (e.g. signed webhook) or named like response DTOs (`*ResponseDto`, `*ItemDto`, …). |
| **`SECURITY DEFINER`** | Any **active runtime** SQL using `SECURITY DEFINER` must be listed in **`docs/security/security-definer.md`** (and stale entries are rejected). Historical migrations are excluded from this runtime check. |

## Local run

```bash
node scripts/check-tenant-isolation-guardrails.mjs
```

Root package alias:

```bash
pnpm guardrails:tenant-isolation
```

## Allowlist (`scripts/tenant-isolation-guardrails.allowlist.json`)

- **`dataSourceQueryPaths`**: Narrow exemptions where raw SQL is intentional (health probe, DEFINER helpers, invite RPC).
- **`bodyDtoAllowlist`**: DTO class names that legitimately carry **`tenant_id`** in JSON bodies after explicit security review.
- **`dtoResponseNameSuffixes`**: Naming convention so response projections are not flagged.

Any new exemption should carry a **short justification in the PR**.

## Deliberate gaps (future work)

- **`createQueryBuilder`** without an explicit `tenant_id` predicate is **not** statically verified (needs AST / SQL-aware lint).
- **Raw SQL inside string literals** on repositories is not fully modeled.

Prefer patterns already enforced in production: **JWT + Host alignment**, **RLS**, **`ownership-scope`** helpers, and reviewed runtime privileged flows documented in **`docs/security/security-definer.md`**.
