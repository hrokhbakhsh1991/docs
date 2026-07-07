```yaml
pack: P7-denali-customer-live
pack_version: "1.6"
status: STAGING_COMPLETE
prerequisite: P6-complete
current_task: P7-3-N-005
nano_spec_total: 27
nano_staging_done: 23
nano_total: 27
exit_nano: P7-3-N-005
blocker: T4_customer_sign_off
p6_regression: pnpm run p6:gate
p7_gate: pnpm run p7:gate
p7_staging_verify: pnpm run p7:staging-verify
p7_staging_gate: pnpm run p7:staging-gate
p7_staging_e2e: pnpm run p7:staging-e2e-probe
p7_t4_closeout: pnpm run p7:t4-closeout
machine_snapshot: AGENT-CURRENT-PHASE.yaml
doc_sot: ../platform-denali-customer-delivery.mdoc
exit_handoff: P7-EXIT-HANDOFF.md
implementation_truth: appendices/IMPLEMENTATION-TRUTH-P7.md
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
