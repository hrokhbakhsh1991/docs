## TEST MATRIX (Appendix E)

```yaml
test_matrix:
  - id: TK-1
    layer: tenant-kernel
    scenario: "reserved label api → not tenant"
    enforcement: P4-E-HOST-01
  - id: TK-2
    layer: tenant-kernel
    scenario: "valid acme.localhost label"
    enforcement: P4-E-HOST-01
  - id: RLS-1
    layer: postgres
    scenario: "A inserts B select 0 rows"
    enforcement: P4-E-RLS-01
  - id: AUTH-1
    layer: api
    scenario: "dev bearer prod 401"
    enforcement: P4-E-AUTH-01
  - id: EVT-1
    layer: events
    scenario: "TourCreated has tenantId"
    enforcement: P4-E-EVT-01
  - id: TH-1
    layer: web
    scenario: "tenant-a accent ≠ tenant-b"
    subphase: "4.4"
    api_route: "GET /api/v2/tenant-config"
    prove_with:
      - "pnpm --filter @apps/api test -- test/tenant-config.spec.ts"
      - "web e2e accent A≠B when Playwright wired"
    completion_proof: subphases/4.4-tenant-theme.md
    required_for_closure: true
    dod: DOD-7
  - id: OBS-1
    layer: api
    scenario: "structured log includes tenantId on scoped route"
    enforcement: observability_scaffold
    subphase: "4.1–4.5"
    gating: false

gate_count_floors:
  source: scripts/guards/gate-thresholds.mjs
  tenant_kernel_phase4: 6
  platform_events_phase4: 2
  phase_4_gate_command: pnpm run phase-4:gate
  guard_report: reports/phase-4-gate-YYYY-MM-DD.json
```
