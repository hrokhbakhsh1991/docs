```yaml
pack: P7-denali-customer-live
pack_version: "1.2"
status: IN_PROGRESS
prerequisite: P6-complete
current_task: P7-0-N-002
nano_spec_total: 27
nano_staging_done: 1
nano_total: 27
exit_nano: P7-3-N-005
p6_regression: pnpm run p6:gate
p7_gate: pnpm run p7:gate
machine_snapshot: AGENT-CURRENT-PHASE.yaml
doc_sot: ../platform-denali-customer-delivery.mdoc
doc_architecture: appendices/P7-DOC-ARCHITECTURE.md
execution_discipline: appendices/P7-EXECUTION-DISCIPLINE.md
decisions: appendices/DEC-P7-INDEX.md
extension_guide: appendices/PACK-EXTENSION-GUIDE.md
implementation_standards: ../p7-implementation-standards.mdoc
implementation_truth: appendices/IMPLEMENTATION-TRUTH-P7.md
traceability: appendices/TRACEABILITY-MATRIX-P7.md
smoke_map: appendices/SMOKE-SCENARIO-MAP-P7.md
execution_order: [P7-0, P7-1, P7-2, P7-3]
epics:
  P7-0: { nanos: 5, spec: 5, done_staging: 1, spec_file: p7-0-live-infra.md }
  P7-1: { nanos: 9, spec: 9, done_staging: 0, spec_file: p7-1-wizard-completion.md }
  P7-2: { nanos: 8, spec: 8, done_staging: 0, spec_file: p7-2-workspace-ops.md }
  P7-3: { nanos: 5, spec: 5, done_staging: 0, spec_file: p7-3-delivery-exit.md }
payment_model: offline_receipt
workspace: denali
post_p7_horizon: appendices/POST-P7-HORIZON.md
```

| Nano | Spec | Runbook / proof |
| ---- | ---- | --------------- |
| **P7-0-N-001** | [p7-0-live-infra.md](p7-0-live-infra.md) | ✅ [runbooks/p7-0-staging-walkthrough.md](runbooks/p7-0-staging-walkthrough.md) |
| **P7-0-N-002** | p7-0-live-infra.md | [runbooks/p7-0-env-matrix.md](runbooks/p7-0-env-matrix.md) |
| P7-0-N-003 | p7-0-live-infra.md | [phase-19/p6/runbooks/first-customer-seed.md](../../phase-19/p6/runbooks/first-customer-seed.md) |
| P7-0-N-004 | p7-0-live-infra.md | [deploy/vps/README.md](../../../deploy/vps/README.md) · SMK-P7-INFRA-01 |
| P7-0-N-005 | p7-0-live-infra.md | `smoke-operator-login.sh` |
| P7-1-N-001 | [p7-1-wizard-completion.md](p7-1-wizard-completion.md) | [runbooks/p7-wizard-blocker-walkthrough.md](runbooks/p7-wizard-blocker-walkthrough.md) |
| P7-1-N-002 .. N-009 | p7-1-wizard-completion.md | wizard specs · staging VS-01 |
| P7-2-N-001 .. N-008 | [p7-2-workspace-ops.md](p7-2-workspace-ops.md) | bookings-ops · VS-06 staging |
| P7-3-N-001 .. N-005 | [p7-3-delivery-exit.md](p7-3-delivery-exit.md) | [runbooks/p7-customer-sign-off.md](runbooks/p7-customer-sign-off.md) |
