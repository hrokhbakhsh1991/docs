# Phase 6 — Cross-cutting actions

```yaml
scope: phase_6_global
enforcement_req_ids: ["REQ-P6-020", "REQ-P6-021", "REQ-P6-025", "REQ-P6-030"]
```

## P6-X-A01 — Depcruise Denali isolation

```yaml
description: Ensure no DENALI_* in apps/api generic layer and no legacy imports in trunk apps
inputs:
  - .dependency-cruiser rules
  - apps/api/src
validation:
  - pnpm run guard:import-boundary exit 0
outputs:
  - CONSISTENCY-REPORT row PASS
```

## P6-X-A02 — platform-core diff audit

```yaml
description: PR checklist — zero Denali-only platform-core changes
validation:
  - REQ-P6-021 manual review on each Phase 6 PR
forbidden:
  - if (workspaceType === 'denali') in platform-core
```

## P6-X-A03 — Starter regression

```yaml
description: Denali work must not break starter workspace
validation:
  - resolve-workspace-plugin.spec.ts starter cases
  - REQ-P6-025
```

## P6-X-A04 — Doc truth audit

```yaml
description: Every REQ-P6 row in verification-matrix has spec path or BLOCKER
validation:
  - REQ-P6-030 at 6.9
  - CONSISTENCY-REPORT PASS
```
