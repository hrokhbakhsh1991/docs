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
pnpm run guard:public-catalog-m17          # M17 · dynamic check count
pnpm --filter @app-tour/guest-surface-host run test   # G-ENV-01..03
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test \
  test/resolve-catalog-list-features.spec.ts \
  test/resolve-catalog-detail-sections.spec.ts \
  test/resolve-catalog-registration-support.spec.ts   # SDK-CAT-*
# tenant-kernel: build-dev-portal-public-base-url · multi-level-host-parse
# API: p6-host-tenant-parity · p6-guest-slice · p6-offline-receipt · p6-preservation · booking-http-postgres · exit
# Booking DoD (TODO-008): test:booking-http-postgres — not memory bookings-ops

# marketing: resolve-web-registration-url · guest-theme-stack
# portal: p6-theming-file-tree · guest-theme-stack · portal-host-bind · portal-member · portal-home-redirect
# web: portal-registration-redirect · finance-page · finance-dashboard-widget
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

**CI:** `.github/workflows/p6-denali-gate.yml` — `p6:gate` on PR (paths include M17 · guest-surface-host · workspace-sdk catalog · catalog UI docs); E2E weekly; `p6:staging-gate` via `workflow_dispatch`.

**CI prep (EX-P6-05):** product / E2E / staging jobs must emit dist via `bash scripts/ci/build-api-workspace-deps.sh` (sdk · contracts · every `packages/workspaces/*/` with `build` · `workspace-plugin-host` · `guest-surface-host`) — not bare `pnpm --filter @app-tour/workspace-* run build`. Product job also provisions Postgres + `db:migrate:deploy` + empty `apps/api/.env` / `.env.local` (node `--env-file` requires the paths) because `p6:gate` requires `DATABASE_URL` for Booking HTTP→Postgres DoD. Exit contract `platform-denali-first-customer-exit.spec.ts` asserts the workflow cites `build-api-workspace-deps.sh` (and still wires `p6:gate` / `p6:e2e-gate` / `p6:staging-gate`).

---

### P6-4-N-007 — p6:e2e-gate + E2E runbook

**Do:** `scripts/p6-denali-e2e-gate.sh` runs `p6:gate` + web SMK-P6-VS-01 + portal + marketing smokes. Runbook: [runbooks/p6-e2e-smoke.md](runbooks/p6-e2e-smoke.md).

**Verify:** `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK`

**Not in product gate alone** — use `p6:e2e-gate` for pre-staging / Architect YES.

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
