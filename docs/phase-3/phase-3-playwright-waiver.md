# Phase 3 — Playwright waiver (EC-33-3 / EC-33-4)

```yaml
waiver_id: P3-PLAYWRIGHT-SOFT
subphase: "3.3"
exit_criteria:
  - id: EC-33-3
    check: "Playwright create tour happy path"
    status: waived
    blocking: false
  - id: EC-33-4
    check: "Playwright CASL deny — no --ws-* on DOM when theme denied"
    status: waived
    blocking: false
rationale: |
  Phase 3 gate (p3_web_gate) enforces lint + unit tests + build.
  Runtime E2E is tracked for a dedicated PR (3.3.e2e) after Phase 3 lock candidate SHA.
replacement_proof:
  - apps/web/test/workspace-wizard-host.security.spec.tsx
  - apps/web/test/wizard-access.spec.ts
  - theme-react provider deny tests (phase-2/3 chain)
revoke_when: "Playwright added under apps/web/e2e with CI job"
```

**Signed-off for Gate-passed:** Engineering audit 2026-06-04 — not required for `phase-3:gate` PASS.
