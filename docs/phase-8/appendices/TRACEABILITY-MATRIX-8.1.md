# Phase 8.1 — Requirements traceability matrix

```yaml
matrix_version: "2026-06-07-v1"
subphase: "8.1"
authority: audits/verification-matrix.md · subphases/8.1-single-owner-auth.md
scope: "8.1 Single-Owner auth — execution genealogy"
prerequisite_rows: [REQ-P8-001, REQ-P8-007]
enforcement_rows: [INV-P8-007, RULE-P8-004]
downstream_row: [REQ-P8-042]
```

> One row per **Requirement ID** active in the 8.1 closure chain. **API dispatch** values cite [`urban-api-dispatch-addendum.md`](urban-api-dispatch-addendum.md). **Smoke** values cite [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md). Where 8.1 proves via gate artifact (no unit spec), the **Target test file path** column names the forensic artifact path from [`audits/verification-matrix.md`](../audits/verification-matrix.md).

---

## Master traceability table

| Requirement ID  | Design specification location                                                                                                                                                                                          | API dispatch handler                                                                                                                                                                                                              | Action registry ID                                        | Smoke test ID                                                | Target test file path                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REQ-P8-001**  | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md) §1 Behavioral Objective · §3 Completion Proof Matrix CP-8.0-01                                                                                                   | `N/A` — 8.0 gate; no 8.1 HTTP route                                                                                                                                                                                               | **P8-0-A01** (prerequisite)                               | `N/A` — entry gate                                           | `reports/phase-8-entry-verified.yaml` · proof command `pnpm run phase-7:gate`                                                                                                                       |
| **REQ-P8-004**  | [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md) §C Workspace settings (owner-only) · [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) § Surface → route mapping                                                 | `handleGetUrbanSettings` · `handlePatchUrbanSettings` · `apps/api/src/urban/urban-settings.routes.ts` (`operationId`: `getUrbanSettings` · `patchUrbanSettings`)                                                                  | **P8-1-A03** · **P8-1-A05**                               | **SMK-P8-03** · **SMK-P8-04**                                | `apps/api/test/urban-settings-patch.spec.ts` · doc gate: `docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md`                                                                                            |
| **REQ-P8-007**  | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md) §1 Anti-creep baseline · [`audits/verification-matrix.md`](../audits/verification-matrix.md) INV-P8-004 linkage                                                  | `N/A` — static import scan; no HTTP handler                                                                                                                                                                                       | **P8-0-A04** · **P8-1-A06** (regression)                  | `N/A` — guard check                                          | `reports/phase-8-gate-2026-06-07.json` (`checks[].id` = `p8_no_legacy_runtime_import`)                                                                                                              |
| **REQ-P8-010**  | [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) § `isWorkspaceOwner` · § `TenantAuthz` extension (`canPerformUrbanOwnerMutation`) · § Verification artifacts SDK row                                            | `N/A` — SDK grant; consumed by `assertWorkspaceOwner` in dispatch pipeline step ③ before handlers                                                                                                                                 | **P8-1-A01**                                              | `N/A` — 8.1 unit; **SMK-P8-03** exercises owner grant at 8.4 | `packages/workspace-sdk/test/urban-owner-ability.spec.ts`                                                                                                                                           |
| **REQ-P8-011**  | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) §1 Web guard deliverable · [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) § Web layer (`canLoadUrbanSettings`)                   | `N/A` — Web RSC `/settings/urban`; not `DISPATCH_ROUTES`                                                                                                                                                                          | **P8-1-A04**                                              | **SMK-P8-03** · **SMK-P8-04**                                | `apps/web/test/urban-owner-access.spec.ts`                                                                                                                                                          |
| **REQ-P8-012**  | [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) § API middleware `assertWorkspaceOwner` · § API error catalog `URBAN_OWNER_REQUIRED` · [`urban-api-dispatch-addendum.md`](urban-api-dispatch-addendum.md) §3–§4 | `handleGetUrbanSettings` (`assertWorkspaceOwner` · `surface: "urban.settings.read"`) · `handlePatchUrbanSettings` (`assertWorkspaceOwner` · `surface: "urban.settings.update"`) · `apps/api/src/urban/require-workspace-owner.ts` | **P8-1-A02** · **P8-1-A03**                               | **SMK-P8-03** · **SMK-P8-04**                                | `apps/api/test/urban-owner-ability.spec.ts` · `apps/api/test/urban-settings-patch.spec.ts`                                                                                                          |
| **INV-P8-007**  | [`appendices/IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) DEC-P8-001 · [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) § Authorization outcome matrix § Settings                                  | `handleGetUrbanSettings` · `handlePatchUrbanSettings` — owner-only per RULE-P8-004                                                                                                                                                | **P8-1-A01** · **P8-1-A02** · **P8-1-A03** · **P8-1-A04** | **SMK-P8-03** · **SMK-P8-04**                                | `packages/workspace-sdk/test/urban-owner-ability.spec.ts` · `apps/api/test/urban-owner-ability.spec.ts` · `apps/api/test/urban-settings-patch.spec.ts` · `apps/web/test/urban-owner-access.spec.ts` |
| **RULE-P8-004** | [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) § Forbidden patterns · [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md) § RULE-P8-004 implementation contract                                                   | `handlePatchUrbanSettings` — `isWorkspaceOwner` only; `isAdminOrOwner` forbidden on urban owner surfaces                                                                                                                          | **P8-1-A01** · **P8-1-A02** · **P8-1-A05**                | **SMK-P8-04** (member/admin denied)                          | `packages/workspace-sdk/test/urban-owner-ability.spec.ts` (SDK-8.1-02 · SDK-8.1-05 · SDK-8.1-08) · `apps/api/test/urban-settings-patch.spec.ts` (member/admin **403**)                              |
| **REQ-P8-042**  | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md) CP-8.4-04 · [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md) § SMK-P8-04                                                                         | `handleGetUrbanSettings` · `handlePatchUrbanSettings` — HTTP chain in `describe('SMK-P8-04')`                                                                                                                                     | **P8-1-A03** · **P8-1-A04** (8.1 auth regression)         | **SMK-P8-04**                                                | `apps/web/tests/e2e/urban-e2e-integrity.spec.ts` · `apps/api/test/urban-e2e-http.spec.ts`                                                                                                           |

---

## Action registry cross-walk (P8-1-A\*)

| Action registry ID | Primary requirement IDs                           | Target test file path                                                                                               |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **P8-1-A01**       | REQ-P8-010 · INV-P8-007 · RULE-P8-004             | `packages/workspace-sdk/test/urban-owner-ability.spec.ts`                                                           |
| **P8-1-A02**       | REQ-P8-012 · INV-P8-007 · RULE-P8-004             | `apps/api/test/urban-owner-ability.spec.ts`                                                                         |
| **P8-1-A03**       | REQ-P8-004 · REQ-P8-012 · INV-P8-007 · REQ-P8-042 | `apps/api/test/urban-settings-patch.spec.ts`                                                                        |
| **P8-1-A04**       | REQ-P8-011 · INV-P8-007 · REQ-P8-042              | `apps/web/test/urban-owner-access.spec.ts`                                                                          |
| **P8-1-A05**       | REQ-P8-004 · RULE-P8-004                          | `docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md` · `docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md` (CP-8.1-05/06) |
| **P8-1-A06**       | REQ-P8-007 (regression) · INV-P8-001              | `reports/phase-8-gate-2026-06-07.json` (`p8_platform_core_zero_diff`) · `pnpm run guard:import-boundary`            |

---

## Smoke scenario cross-walk (settings auth)

| Smoke test ID | Requirement IDs                                                 | API dispatch handler                                                        | Target test file path                                                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SMK-P8-03** | REQ-P8-004 · REQ-P8-011 · REQ-P8-012 · INV-P8-007               | `handleGetUrbanSettings` · owner session · `GET /urban/settings`            | `apps/web/tests/e2e/urban-e2e-integrity.spec.ts` (`test('SMK-P8-03')`) · `apps/api/test/urban-e2e-http.spec.ts` (`describe('SMK-P8-03')`) · 8.1 unit: `apps/api/test/urban-settings-patch.spec.ts` (owner **200**)                                           |
| **SMK-P8-04** | REQ-P8-011 · REQ-P8-012 · INV-P8-007 · RULE-P8-004 · REQ-P8-042 | `handleGetUrbanSettings` · `handlePatchUrbanSettings` · member session deny | `apps/web/tests/e2e/urban-e2e-integrity.spec.ts` (`test('SMK-P8-04')`) · `apps/api/test/urban-e2e-http.spec.ts` (`describe('SMK-P8-04')`) · 8.1 unit: `apps/api/test/urban-settings-patch.spec.ts` (API-8.1-04) · `apps/web/test/urban-owner-access.spec.ts` |

---

## ERIP / dispatch supplements

| Artifact                                                           | Binds to requirement IDs                           |
| ------------------------------------------------------------------ | -------------------------------------------------- |
| [`erip/8.1-cop-auth-isolation.md`](erip/8.1-cop-auth-isolation.md) | INV-P8-007 · REQ-P8-010 · REQ-P8-012 · RULE-P8-004 |
| [`urban-api-dispatch-addendum.md`](urban-api-dispatch-addendum.md) | REQ-P8-004 · REQ-P8-012                            |

---

## Verification bundle (8.1 closure)

```bash
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/urban-owner-access.spec.ts
pnpm run phase-8:guard
```

**REQ coverage:** REQ-P8-001 · REQ-P8-004 · REQ-P8-007 · REQ-P8-010 · REQ-P8-011 · REQ-P8-012 · INV-P8-007 · RULE-P8-004 · REQ-P8-042 (downstream E2E).
