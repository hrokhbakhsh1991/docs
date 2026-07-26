# API host — tenant request ingress

```yaml
surface: apps/api/src/tenant-kernel
role: host_request_identity_ingress
not_the_same_as: "@app-tour/tenant-kernel"
kernel_design: docs/phase-saas-kernel/appendices/SK1_TENANT_AUTHZ_CONTRACTS.md
```

## What this folder is

HTTP/API **identity ingress** for the operator/API host:

- `resolveTenantContextFromRequest` — JWT (when configured) → gated dev bearer → test-only headers
- JWT env / key helpers, session claim attach, auth error constants

It produces `TenantAuthContext` for downstream identity/authz (CASL, membership hydrate, etc.).

## What this folder is not

| Not this | Use instead |
| -------- | ----------- |
| Host/RLS/route package | `@app-tour/tenant-kernel` (`packages/tenant-kernel`) |
| Member session cookie writer | Portal / **PCMS-001** (`atour_mb_session`) |
| Ops service scopes | `internal/verify-ops-service-jwt` |

Phase 4.1 deliberately keeps JWT / request resolution **out** of the npm package until a dedicated extraction ADR. Do not “clean up” by merging this tree into `packages/tenant-kernel` without that ADR.

## Rename policy

A future rename (e.g. `tenant-ingress/`) is **deferred** — high import churn. Prefer this README + SK1 docs until an explicit rename PR is approved.
