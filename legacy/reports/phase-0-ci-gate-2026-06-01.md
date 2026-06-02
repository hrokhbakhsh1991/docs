# Phase 0 CI gate — 2026-06-01

- **Generated:** 2026-06-01T15:45:55.139Z
- **Git SHA:** `cafe04e`
- **Node:** v22.22.0
- **JSON:** [reports/phase-0-ci-gate-2026-06-01.json](reports/phase-0-ci-gate-2026-06-01.json)

## Gates

| Gate | Required | Result | Duration |
|------|----------|--------|----------:|
| ci_integrity | yes | PASS | 102.6s |
| web_build | yes | PASS | 91.4s |
| structural_guards | no | PASS | 5.7s |
| api_structural_integrity | no | PASS | 1.4s |
| root_build_known_issue | no | FAIL | 11.5s |
| draft_engine_test | no | PASS | 1.7s |
| playwright_smoke_subset | yes | FAIL | 583.3s |

## Phase 0.3 exit

- **0.3 required gates:** FAIL

## Known issues (baseline)

- **node_engine** (warn): Root package.json wants Node 24; record actual runtime below.
- **root_pnpm_build** (info): Full `pnpm run build` may fail on @repo/shared-contracts → @repo/types/denali; not a Phase 0.3 blocker.
- **legacy_archive_docs** (info): quarantine-integrity-check.md / final-trace-audit.md may mention legacy_archive; runtime imports are zero.
- **e2e_isolation** (info): pnpm test:e2e:isolation requires Docker DB; run before large merges, not required for 0.3 exit.

## Failure tails

### root_build_known_issue

### playwright_smoke_subset

```
ebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: 'af7f8263-696c-4df0-9889-d8b7d0f10a4f'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: '0161568a-b4d8-435f-84d6-c8bc575e5848'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: 'ec584e7b-02ca-4563-82a3-9553956cb1c5'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: '1176895d-3145-4078-bd41-e1f8325427fa'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: '128c3315-4cb7-48ca-a627-0e43457d8d1b'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: 'cf2b42c5-97e3-4c00-8696-e5f4c70f4f29'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: 'de9ce3b6-52ab-4ede-872c-ee5f6d018f25'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: 'deb08030-839f-4c3d-a988-1f4ee3161ed5'
[WebServer] }
[WebServer] tenant_mismatch_detected {
[WebServer]   layer: 'bff',
[WebServer]   event: 'bff_error',
[WebServer]   tenant_mismatch: true,
[WebServer]   correlation_id: '75d20be4-0583-417a-88d1-3847e4ef5850'
[WebServer] }
```

