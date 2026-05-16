# Security CI guardrails

Deterministic static checks run in GitHub Actions (`.github/workflows/architecture-guardrails.yml`) to catch common authorization and tenant-scope mistakes before merge.

## Mutation route RBAC

**Script:** `scripts/check-security-mutation-guardrails.mjs`  
**Allowlist:** `scripts/security-mutation-guardrails.allowlist.json`

Scans `apps/api/src/modules/**/*.controller.ts` (excluding `auth.controller.ts` by default) for **mutation handlers** (`@Post`, `@Put`, `@Patch`, `@Delete` in the decorator stack above each `async` method).

Each mutation must satisfy **one** of:

1. **`AuthorizationPresenceGuard` + `RolesGuard` + `AbilitiesGuard` + `CaslMirrorAbilitiesGuard` + `@CheckAbilities(...)`** on the handler (class-level `@CheckAbilities` merges with method metadata) — normal workspace-authenticated routes.
2. **`InternalApiKeyGuard`** — internal ops routes.
3. **`PaymentWebhookSignatureGuard`** — signed provider webhooks (often with `ThrottlerGuard`).
4. **Allowlist: `methodsAllowingAuthorizationPresenceOnly`** — authenticated flows without the full stack (e.g. invite accept bootstrap).
5. **Allowlist: `methodsAllowingThrottlerOnly`** — intentionally public throttled endpoints (e.g. public registration).

See also: `apps/api/docs/RBAC-SECURITY-COVERAGE.md`.

Guards on the **controller preamble** (decorators between the previous class end and `export class …`) are merged with **method-local** `@UseGuards` in the decorator stack above `async`.

```bash
node scripts/check-security-mutation-guardrails.mjs
pnpm guardrails:security
```

## Tenant isolation (DTOs, raw SQL, QueryBuilder)

**Script:** `scripts/check-tenant-isolation-guardrails.mjs`  
**Allowlist:** `scripts/tenant-isolation-guardrails.allowlist.json`

Covers **`@Body()` DTO tenant fields**, **`req.body` tenant reads**, **`dataSource.query`** allowlisting + SQL body review, **`manager.query`** tenant predicates, **`createQueryBuilder`** chain heuristics, and the **`SECURITY DEFINER`** registry. Details: [Tenant isolation — automated guardrails](../tenant-isolation-guardrails.md).

Legacy note: DTO classes under `apps/api/src/modules/**/dto/**` that declare **`tenant_id`** or **`tenantId`** as request-shaped fields are flagged when referenced as `@Body()` types on controllers, unless the class name matches a **response-style suffix** or **`bodyDtoAllowlist`**. Comments are stripped before matching so `// tenantId is never…` does not false-negative real fields.

## Pipeline

The **security-ci-guardrails** job runs `check-security-mutation-guardrails.mjs`. Tenant isolation checks (`check-tenant-isolation-guardrails.mjs`) run under the **tenant-isolation-guardrails** job.

All scripts use plain Node (no network, no TypeScript compiler) for **deterministic** CI output.
