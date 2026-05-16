# Tenant isolation — automated guardrails

CI runs **`scripts/check-tenant-isolation-guardrails.mjs`** (see `.github/workflows/architecture-guardrails.yml`) to reduce accidental **tenant isolation regressions**.

## What is enforced

| Check | Intent |
|--------|--------|
| **`dataSource.query`** | Raw SQL bypasses TypeORM + tenant session binding (`SET LOCAL app.tenant_id`). Only explicitly allowlisted runtime files may call `dataSource.query`. |
| **`dataSource.query` SQL body** | On allowlisted files, each static SQL argument must reference **`tenant_id` / `workspace_id` / `app.tenant_id`**, or be a **catalog / health** probe (`information_schema`, `SELECT 1`, …). |
| **`@Body()` + `tenant_id` / `tenantId`** | Request DTO classes that expose **`tenant_id`** or **`tenantId`** must not be accepted from the client unless allowlisted (e.g. signed webhook) or named like response DTOs (`*ResponseDto`, `*ResultDto`, `*ItemDto`, …). |
| **`req` / `request` body tenant** | Direct reads of **`tenantId` / `tenant_id`** from **`req.body`** (including bracket access) are rejected — tenant scope must not be client-supplied. |
| **`manager.query` raw SQL** | `EntityManager.query(...)` must embed **`tenant_id` / `workspace_id` / `app.tenant_id`** in the SQL text (defense-in-depth); catalog-shaped SQL is exempt. |
| **`createQueryBuilder` chain** | Each builder chain (through the first **`.getMany` / `.getOne` / `.execute` / …**) must contain an explicit **tenant / workspace** predicate, unless the preceding lines include **`// tenant-isolation:qb-exempt`** with a short justification. |
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
- **`dtoResponseNameSuffixes`**: Naming convention so response projections are not flagged (includes `ResultDto` for invite/resend payloads).

Security-focused mutation scanning is documented in **[Security CI guardrails](security/security-ci-guardrails.md)**.

Any new exemption should carry a **short justification in the PR**.

## Deliberate gaps (future work)

- **QueryBuilder** scanning is **textual** (chain boundary + keyword heuristics), not SQL/AST-aware — prefer explicit tenant/workspace predicates and narrow `qb-exempt` comments.
- **Dynamic SQL** (non-literal first arguments to `query(`) is flagged for allowlisted `dataSource.query` and for `manager.query`.

Prefer patterns already enforced in production: **JWT + Host alignment**, **RLS**, **`ownership-scope`** helpers, and reviewed runtime privileged flows documented in **`docs/security/security-definer.md`**.
