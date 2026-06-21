```yaml
pack: P6-denali-first-customer
version: "2.0"
status: READY
prerequisite: P5-B-N-016
current_task: P6-0-N-001
nano_done: 0
nano_total: 56
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
payment_model: offline_receipt
workspace: denali
three_apps:
  marketing: "apps/marketing · shop.{club}.{root}"
  portal: "apps/portal · {club}.portal.{root}"
  admin: "apps/web (app)/ · {club}.admin.{root}"
execution_order: [P6-0, P6-1, P6-2, P6-3, P6-4]
epics:
  P6-0: { nanos: 8, done: 0, spec: p6-0-host-subdomain.md }
  P6-1: { nanos: 14, done: 0, spec: p6-1-guest-slice.md, blocked_by: [P6-0] }
  P6-2: { nanos: 16, done: 0, spec: p6-2-operator-admin.md, blocked_by: [P6-1-N-014] }
  P6-3: { nanos: 10, done: 0, spec: p6-3-member-portal.md, blocked_by: [P6-1-N-014] }
  P6-4: { nanos: 8, done: 0, spec: p6-4-exit-gate.md, blocked_by: [P6-2, P6-3] }
deprecated_epics:
  P6-A: superseded by P6-0 + P6-1
  P6-B: split — register in P6-1 · /me in P6-3
  P6-C: renamed P6-2
  P6-D: renamed P6-4
```
