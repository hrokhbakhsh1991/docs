# Phase 3.2 — Red-flag status report (TEMPLATE)

```yaml
report_type: phase-3.2-red-flag-status
required_for: Phase 4 subphase 4.0 — P4-E-RF-40
guard: p4_red_flag_prerequisite
copy_to: reports/phase-3.2-red-flag-status-YYYY-MM-DD.md
backlog: docs/backlog/phase-3.2-red-flag-backlog.md
```

## Instructions

1. Copy this file to `reports/phase-3.2-red-flag-status-YYYY-MM-DD.md`.
2. Set `date` and `git_sha` from `git rev-parse --short HEAD`.
3. Mark each track **PASS** only with evidence (test path or command output).
4. Run `pnpm run phase-4:guard` — `p4_red_flag_prerequisite` must be **ok: true**.

---

## Track status

| Track | Red flags | Status | Evidence |
|-------|-----------|--------|----------|
| **R0** | RF-F09 | PASS / FAIL | `apps/api/src/tenant-kernel/tenant-kernel.spec.ts` |
| **R1** | RF-F05, RF-F06 | PASS / FAIL | `apps/web/app/layout.tsx` force-dynamic |
| **R2** | RF-SCALE-* | PASS / FAIL | `apps/api/src/storage/in-memory-tour.repository.spec.ts` |
| **R3** | RF-F08 | PASS / FAIL | Web server action → `POST /tours` |

```yaml
metadata:
  date: "YYYY-MM-DD"
  git_sha: "short"
  phase_3_gate: "pnpm run phase-3:gate exit 0"
  architect_signoff: false
```

## Backlog cross-check

- [ ] Rows in [`audit-red-flags-phase-3.md`](../docs/archive/root-forensics/audit-red-flags-phase-3.md) P0/P1 updated
- [ ] [`phase-3.2-red-flag-backlog.md`](../docs/backlog/phase-3.2-red-flag-backlog.md) exit § updated

**Do not merge 4.1+ while any track is FAIL without Architect waiver.**
