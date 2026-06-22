# P6-4 — Exit gate & staging

```yaml
epic: P6-4
nanos: 8
priority: 5
status: COMPLETE
prerequisite: [P6-2, P6-3]
exit: P6-4-N-008
gate: pnpm run p6:gate
```

## Goal

Full vertical slice VS-01..08 · `p6:gate` · first customer staging runbooks.

---

## Nanos

### P6-4-N-001 — Vertical slice mdoc

**Do:** `docs/phase-19/platform-denali-vertical-slice.mdoc` — all VS steps, three app URLs.

**Verify:** cross-linked

---

### P6-4-N-002 — Gate script

**Do:** `scripts/p6-denali-product-gate.sh` (actual composition):

```bash
pnpm run guard:p3-denali-covenant
pnpm run guard:import-boundary
# tenant-kernel: build-dev-portal-public-base-url · multi-level-host-parse
# API: p6-host-tenant-parity · p6-guest-slice · p6-offline-receipt · p6-preservation · bookings-ops · exit
# marketing: resolve-web-registration-url · guest-theme-stack
# portal: p6-theming-file-tree · guest-theme-stack · portal-host-bind · portal-member · portal-home-redirect
# web: portal-registration-redirect
echo P6_DENALI_PRODUCT_GATE_OK
```

**Verify:** `pnpm run p6:gate` exits 0

---

### P6-4-N-003 — package.json `p6:gate`

**Do:** wire script · exits 0 when P6 complete.

---

### P6-4-N-004 — Exit spec

**Do:** `apps/api/test/platform-denali-first-customer-exit.spec.ts` — checklist, DOC-SYNC v2.1, gate script.

---

### P6-4-N-005 — Customer seed runbook

**Do:** `runbooks/first-customer-seed.md`

---

### P6-4-N-006 — Staging deploy checklist

**Do:** `runbooks/staging-deploy.md` — three apps + API + subdomain DNS.

---

### P6-4-N-007 — p6:e2e-gate + E2E runbook

**Do:** `scripts/p6-denali-e2e-gate.sh` stub + full runbook [runbooks/p6-e2e-smoke.md](runbooks/p6-e2e-smoke.md) (SMK-P6-PTL-01 · SMK-MKT-03 · host smoke).

**Verify:** runbook lists Playwright configs · commands · env matrix

**Not in product gate** — Architect YES for CI wiring.

---

### P6-4-N-008 — P6 closure

**Do:** exit checklist `status: complete` · `nano_done: 58` · README updated.

**Verify:** VS-08 · EX-P6-06

---

## Full vertical slice

| ID | EPIC | Step |
| -- | ---- | ---- |
| VS-01 | P6-1 | publish active |
| VS-02 | P6-1 | marketing lists tour |
| VS-03 | P6-1 | portal register success |
| VS-04 | P6-3 | `/me` lists registration |
| VS-05 | P6-3 | member receipt upload |
| VS-06 | P6-2 | operator approve booking |
| VS-07 | P6-2 | operator approve receipt |
| VS-08 | P6-4 | `p6:gate` OK |
