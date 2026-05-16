# Infrastructure Closure Plan (Revised - v2.0)

This plan outlines the final operational phases to harden the Tour Management platform's infrastructure, addressing the gaps identified in the latest audit.

## Phase 1: Structured Error Taxonomy & Strict Mapping
**Goal:** Eliminate "unknown" error paths and generic Error objects.

### 1.1 Error Taxonomy Definition
- [x] Define `GlobalErrorTaxonomy` in `@repo/shared`.
- [x] Map codes for: `AUTH_*`, `TENANT_*`, `RBAC_*`, `SESSION_*` (via `AUTH_SESSION_*`), `API_*` (via `SYSTEM_*` / `RESOURCE_*`).

### 1.2 BFF & API Enforcement
- [x] Update `GlobalExceptionFilter` in API to strictly enforce taxonomy codes (canonical set + taxonomy union).
- [x] Update `bff-error-response.ts` to map all backend statuses to taxonomy codes (core guards + taxonomy normalization).
- [x] Implement `ErrorRegistry` on Frontend — all `GlobalExceptionFilter` canonical codes covered via `canonical-api-error-codes.ts` + `getUIError`.

---

## Phase 2: Elimination of Hidden Fallbacks
**Goal:** Ensure "Fail = Explicit Response" and eliminate silent recoveries.

### 2.1 Tenant Resolution Audit
- [x] Remove all "fallback to default tenant" logic in `runtime-tenant-context.ts`.
- [x] Ensure SSR returns an explicit "Tenant Unknown" page instead of a generic layout (`/workspace-not-found`).

### 2.2 Session Recovery & Retry Logic
- [x] Audit `bffFetch` retry logic: no automatic retries (explicit fetch only).
- [x] Remove silent session redirect on 401/403 in `apiClient` (opt-in `redirectOn401` / `redirectOn403` only).

---

## Phase 3: Advanced Observability (W3C Trace Chain)
**Goal:** Full visibility into latency and distributed call chains.

### 3.1 Traceparent End-to-End
- [x] Verify `traceparent` propagation from Browser → BFF → API (middleware + `bffFetch` + `RequestContextMiddleware`).
- [x] DB hop: aggregate `db_duration_ms` / `x-db-latency` from OTEL pg spans + REQUEST_TRACE logs.
- [x] Hop latency in `HttpObservabilityInterceptor` debug logs (`traceparent` + `duration_ms`).
- [x] Local Jaeger OTLP: `infra/docker-compose.observability.yml` (`pnpm docker:observability`).

### 3.2 Latency Breakdown
- [x] Add `x-bff-latency` and `x-api-latency` headers to responses for performance debugging.

---

## Phase 4: Tech Debt Zero Verification
**Goal:** Automated enforcement of infrastructure standards.

### 4.1 Debt Scanning Scripts
- [x] `scripts/scan-infrastructure-debt.mjs`:
    - Scan for `legacy-tenant-resolvers`.
    - Scan for `direct-api-calls` in non-allowed directories.
    - Scan for `generic-error-throws` in core paths.
- [x] Integrate script into CI/CD build pipeline (`architecture-guardrails.yml` — `infrastructure-debt-scan` job).
- [x] Burn down allowlisted direct `apiClient` usages in `infrastructure-debt.allowlist.json` to zero (only `api-client.ts` definition remains).

---

## Phase 5: E2E Reality Gate (Stress & Isolation)
**Goal:** Verify system stability under real network conditions and high load.

### 5.1 Load & Storm Testing
- [~] Implement `k6` script for "Login Storm" — `scripts/k6/login-storm.js` + `scripts/run-infrastructure-k6-gate.mjs`; k6 baseline optional.
- [x] Concurrent Tenant Isolation — Node gate `verify-infrastructure-reality-gate.mjs` (login storm, cross-host, latency/trace headers, parallel BFF CREATE).

---

## Phase 6: API Boundary Hardening
**Goal:** Enforce the "BFF-First" architecture.

### 6.1 Boundary Decision
- [x] **Decision:** Implement "Option A" (Enterprise Clean) — ALL Frontend calls MUST go through BFF.
- [x] Audit `apps/web/lib/services` — all services use BFF; browser `apiClient` only defined in `api-client.ts` (legacy imports for types/errors).
- [x] Block Direct API access at the Network/Ingress level — static + `verify-local-nginx-bff-boundary.mjs`; prod: `infra/scripts/deploy-nginx-bff-ingress.sh`.

---

## Verification & Final Sign-off
- [x] Execution of `scan-infrastructure-debt.mjs` returns 0 (with current allowlist; goal: empty allowlist).
- [x] k6 / Node load gate — `verify-infrastructure-reality-gate.mjs` passes locally; tune `INFRA_LOGIN_STORM_COUNT` for heavier k6 runs.
- [x] Static gate: `verify-structured-http-errors.mjs` — GlobalExceptionFilter logs `error_code` on failures.
- [x] Runtime audit sample: `scripts/verify-production-log-sample.mjs` + `pnpm infra:signoff` (fixture in CI; prod drain via `PRODUCTION_LOG_SAMPLE`).
