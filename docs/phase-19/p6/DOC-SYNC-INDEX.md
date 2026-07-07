```yaml
pack: P6-denali-first-customer
version: "2.2-fast-close"
status: CLOSED_FAST
fast_close: p6-fast-close.yaml
prerequisite: P5-B-N-016
current_task: none
nano_done: 58
nano_total: 58
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
payment_model: offline_receipt
workspace: denali
addressing_authority: ../p6-host-addressing-architecture.mdoc
three_apps:
  marketing: "apps/marketing · {club}.{root} (custom: denali.club)"
  portal: "apps/portal · {club}.portal.{root} (custom: portal.denali.club)"
  admin: "apps/web · {club}.admin.{root} (custom: admin.denali.club)"
execution_order: [P6-0, P6-1, P6-2, P6-3, P6-4]
epics:
  P6-0: { nanos: 9, done: 9, spec: p6-0-host-subdomain.md, runbook: runbooks/host-subdomain-map.md }
  P6-1: { nanos: 15, done: 15, spec: p6-1-guest-slice.md, blocked_by: [] }
  P6-2: { nanos: 16, done: 16, spec: p6-2-operator-admin.md, blocked_by: [] }
  P6-3: { nanos: 10, done: 10, spec: p6-3-member-portal.md, blocked_by: [] }
  P6-4: { nanos: 8, done: 8, spec: p6-4-exit-gate.md, blocked_by: [] }
deprecated_epics:
  P6-A: superseded by P6-0 + P6-1
  P6-B: split — register in P6-1 · /me in P6-3
  P6-C: renamed P6-2
  P6-D: renamed P6-4
host_gaps:
  H-P6-02: resolved — canonical {club}.portal.localhost in apps + smoke
  H-P6-04: resolved — p6-host-tenant-parity.spec.ts
  H-P6-05: resolved — host-subdomain-map.md runbook
gate: pnpm run p6:gate
catalog_ui_specs:
  marketing: docs/workspaces/denali/marketing-catalog-ui.md
  portal: docs/workspaces/denali/portal-registration-ui.md
  portal_intake_platform: docs/phase-19/platform-portal-registration-intake.mdoc
  portal_member_profile_platform: docs/phase-19/platform-portal-member-profile.mdoc
  portal_member_profile_denali: docs/workspaces/denali/portal-member-profile.md
  portal_member_registrations_denali: docs/workspaces/denali/portal-member-registrations.md
  portal_member_profile_guard: scripts/guards/guard-portal-member-profile-boundary.mjs
  authority: docs/workspaces/denali/public-catalog.md
  m17_guard: scripts/guards/guard-public-catalog-m17.mjs
vertical_slice: ../platform-denali-vertical-slice.mdoc
agent_navigator: ../AGENT-NAVIGATOR.md
agent_snapshot: AGENT-CURRENT-PHASE.yaml
implementation_truth: appendices/IMPLEMENTATION-TRUTH-P6.md
remaining_checklist: p6-remaining-checklist.md
fast_close: p6-fast-close.yaml
traceability: appendices/TRACEABILITY-MATRIX-P6.md
smoke_map: appendices/SMOKE-SCENARIO-MAP-P6.md
e2e_runbook: runbooks/p6-e2e-smoke.md
finance_note: appendices/FINANCE-OPS-P6-NOTE.md
otp_scope: appendices/OTP-SCOPE-P6.md
doc_completeness: FULL
next_phase: docs/phase-20/README.md
next_phase_entry: docs/phase-20/p7/AGENT-START.md
```
