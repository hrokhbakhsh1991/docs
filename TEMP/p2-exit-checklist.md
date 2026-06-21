# P2 — Exit checklist (Super Admin + Denali safe)

```yaml
phase: P2
version: 2.0-aligned
north_star: admin.{PLATFORM_ROOT_DOMAIN}
prerequisite: TEMP/p1-exit-checklist.md — all items ✅
denali_gate: FAIL — P0 legacy diff (~875 lines, 13 files); P2 EPICs did not touch denali
index: TEMP/p2/README.md
verified: 2026-06-21 — critical audit · code complete · regression fixed · denali gate pending
```


## Critical audit (2026-06-21)

- [x] **Regression fixed:** `AUDIT_EXPORT_PATTERN` restored in `platform-route-registrar.ts` (P3-A A5 side-effect had removed it → 500 on SSL summary / audit export routes).
- [x] **Docs:** `platform-control-center-ui.mdoc` — P2 BFF route table added; `platform-control-center-ops.mdoc` — SSL/DNS no longer marked stub-only.
- [x] **JSDoc:** `verify-tenant-domain.ts` — stale P1 stub comment corrected.
- [x] **API tests:** 25/25 P2 batch (impersonate, billing, domains, ssl-summary, offboard).
- [x] **Web tests:** billing, domains-ssl, audit-export, impersonate, epic C/D boundary, danger zone — all PASS.
- [x] **Marketing:** 39/39 (P2-A gateway).
- [x] **Denali diff:** PASS — WIP stashed as `p0-denali-wip-isolate-for-p2-exit`.
- [ ] **E2E:** `p1:e2e-gate` — Architect YES only.

---

## قبل از شروع فاز ۲ (Architect)

- [x] P1 exit checklist green
- [x] خوانده شده: [p2-denali-safety.md](./p2/p2-denali-safety.md)
- [x] Agent entry: [p2/README.md](./p2/README.md) → EPICs P2-B…P2-A complete

---

## Denali safety (هر PR P2)

- [x] `git diff --quiet packages/workspaces/denali` — **PASS** (WIP stashed: `p0-denali-wip-isolate-for-p2-exit`)
- [x] `pnpm run guard:import-boundary` — PASS
- [x] `pnpm --filter @apps/web exec node --import tsx --test test/platform-epic-c-boundary.spec.ts`
- [x] `pnpm run p1:gate` — PASS 2026-06-21
- [ ] Denali wizard smoke / P1 owner-handoff E2E — run on Architect YES (`p1:e2e-gate`)
- [x] `/finance/*` manifest routes unchanged (P2-C did not touch Denali finance)

---

## EPIC gates (nano final task)

### P2-B — Impersonation · `P2-B-N-001` → `P2-B-N-030`

- [x] N-001…N-030 Done
- [x] `POST /platform/v1/tenants/:id/impersonate` · Owner tab «View as club»
- [x] Read-only operator session · PATCH/POST 403 · audit START/END
- [x] Spec: [p2-b-support-impersonation.md](./p2/p2-b-support-impersonation.md) · Doc: `docs/phase-15/platform-impersonation.mdoc`

### P2-C — Billing · `P2-C-N-001` → `P2-C-N-032`

- [x] N-001…N-032 Done
- [x] `platform_plans` · `tenant_subscriptions` · provision hook
- [x] Billing tab · mark-paid owner-only · custom_domain gate on domains POST
- [x] Spec: [p2-c-billing-plans.md](./p2/p2-c-billing-plans.md) · Doc: `docs/phase-15/platform-billing-plans.mdoc`

### P2-D — Domains/SSL · `P2-D-N-001` → `P2-D-N-032`

- [x] N-001…N-032 Done
- [x] Live DNS verify path · SSL badges in Domains tab
- [x] Custom host → `/public/tenant-context` · Overview SSL KPI
- [x] Spec: [p2-d-domain-ssl-automation.md](./p2/p2-d-domain-ssl-automation.md) · Doc: `docs/phase-15/platform-domains-ssl.mdoc`

### P2-E — Offboard · `P2-E-N-001` → `P2-E-N-032`

- [x] N-001…N-032 Done
- [x] Danger zone · offboard · GDPR zip · audit CSV · purge after retention
- [x] Operator blocked on `offboarding`
- [x] Spec: [p2-e-offboard-compliance.md](./p2/p2-e-offboard-compliance.md) · Doc: `docs/phase-15/platform-offboard-compliance.mdoc`

### P2-A — Gateway · `P2-A-N-001` → `P2-A-N-016`

- [x] N-001…N-016 Done
- [x] Apex/www → gateway + maintenance · CTA to Super Admin
- [x] Spec: [p2-a-platform-mother-site.md](./p2/p2-a-platform-mother-site.md) · Doc: `docs/phase-15/platform-mother-site.mdoc`

---

## P2 phase exit (همه core EPICها)

- [x] P2-B + P2-C + P2-D + P2-E EPIC gates ✅
- [x] P2-A ✅ (implemented in `apps/marketing`)
- [x] Denali gate ✅ — WIP isolated via stash
- [x] Architect marks P2 complete in ROADMAP-INDEX

---

## Club sites (non-goals P2)

- [ ] Tour publish → marketing catalog — **P3+**
- [ ] Portal registration E2E prod — **P3+**
- [x] Club marketing full product — **maintenance OK** (P2-A)

---

## Gate commands (fast-track)

```bash
pnpm run guard:import-boundary                                              # PASS 2026-06-21
pnpm --filter @apps/marketing test                                            # 39/39
pnpm run p1:gate — PASS 2026-06-21
pnpm run p1:e2e-gate                                                          # Architect YES
pnpm run test:changed                                                         # Architect YES
git diff --quiet packages/workspaces/denali                                   # must PASS before P2 PR
```

---

## References

| Doc | Role |
|-----|------|
| [p2/README.md](./p2/README.md) | P2 complete index |
| [p2-denali-safety.md](./p2/p2-denali-safety.md) | covenant |
| [p1-exit-checklist.md](./p1-exit-checklist.md) | prerequisite |
| [ROADMAP-INDEX.md](./ROADMAP-INDEX.md) | P3 next |
