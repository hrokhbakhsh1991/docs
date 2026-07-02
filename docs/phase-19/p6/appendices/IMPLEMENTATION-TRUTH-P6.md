# P6 — Implementation truth (honest ledger)

```yaml
truth_id: IMPLEMENTATION-TRUTH-P6
snapshot_version: "2026-06-23-fast-close"
pack_version: "2.3"
status: CLOSED_FAST
formal_closure_status: CLOSED_FAST
fast_close: ../p6-fast-close.yaml
doc_pack: COMPLETE
code_integration: DEV_SLICE_CLOSED
remaining_checklist: ../p6-remaining-checklist.md
current_item: none
gate_static: pnpm run p6:gate
gate_e2e: pnpm run p6:e2e-gate
gate_staging: pnpm run p6:staging-gate
gate_staging_preflight: pnpm run p6:staging-preflight
gate_closure: P6_FAST_CLOSE=1 pnpm run p6:closure
gate_live: node scripts/smoke-p6-host-bind.mjs
p7_unblocked: true
```

> **Fast-close (2026-06-23):** P6 بسته شد. **Proof:** local `p6:gate` + `p6:e2e-gate` + VPS `:23001` host-bind smoke. **Deferred P7:** full VPS preflight/e2e, DEV production build, MinIO live receipt, wizard publish UI E2E. Covenant: [p6-fast-close.yaml](../p6-fast-close.yaml).

**Bundle F (2026-06-22):**

| Item | Proof |
| ---- | ----- |
| VS-01 publish lifecycle | `tour-publish-transition.spec.ts` LC-04/LC-06 + MKT-API-11c in `p6:gate` |
| Dev closure command | `pnpm run p6:closure` → gate + staging-preflight + checklist |
| PATCH publish HTTP | Blocked by composite canonical validation — wizard UI E2E = P7 |

**Bundle E (2026-06-22):**

| Item | Proof |
| ---- | ----- |
| Postgres finance VS-07 | `finance-ops.spec.ts` API-9.7-01..04 · `p6:staging-preflight` → `P6_STAGING_PREFLIGHT_OK` |
| Staging gate | `pnpm run p6:staging-gate` → `P6_STAGING_GATE_OK` |
| Exit wiring | EX-P6-07 asserts preflight + staging-gate scripts |

**Bundle D (2026-06-22):**

| Item | Proof |
| ---- | ----- |
| P6-2-N-011 dashboard KPI | `finance-dashboard-widget.spec.ts` in `p6:gate` |
| P6-4-N-006 staging deploy | `p6-staging-deploy-verify.sh` + runbook `staging-deploy.md` |
| P6-4 e2e closure | `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK` | ✅ verified 2026-06-22 (~170s) |

**Bundle C (2026-06-22):**

| Item | Proof |
| ---- | ----- |
| Browser chain VS-03..07 | `P6-VS-CHAIN-B01` in `p6:e2e-gate` · verified 2026-06-22 |
| Staging preflight | `pnpm run p6:staging-preflight` |
| VS-01 publish transition | `p6-vs01-admin-publish.spec.ts` API (not wizard UI) |

**Bundle B (2026-06-22):**

| Item | Proof |
| ---- | ----- |
| Chained VS-03..07 | `p6-vertical-slice-chain.spec.ts` P6-VS-CHAIN-01 — same `bookingId` |
| Portal home redirect | `SMK-PTL-05` E2E in `portal-member-smoke.spec.ts` |
| `p6-offline-receipt-gate` | P6-OR-04 asserts chain + member-receipt in `p6:gate` |

### Proof tiers (do not conflate)

| Tier | Meaning | Count (approx) |
| ---- | ------- | -------------- |
| **DOC** | Spec/runbook exists | 58 / 58 |
| **E2E** | Browser smoke in `p6:e2e-gate` | VS-01..07 + host bind |
| **API_MEMORY** | In-memory HTTP / handler in `p6:gate` | ~28 nanos |
| **STATIC** | Wiring / anti-delete / SSR marker read | ~12 nanos |
| **DEFERRED** | MinIO live · staging deploy execution · wizard UI publish E2E | P7 / ops |
| **STAGING_POSTGRES** | `finance-ops.spec.ts` when `DATABASE_URL` set | `p6:staging-gate` · `p6:staging-preflight` |

**Forbidden claim:** `58/58 behavioral` without tier — use this ledger instead.

---

### 2026-06-22 — SMK-MKT-03 root cause (P6-1-N-014)

`packages/workspaces/denali/workspace.manifest.json` was missing the Phase 14 `httpRoutes` block. Codegen therefore emitted **urban-only** `workspace-http-routes.generated.ts` — `GET /denali/catalog` and finance routes returned host `NOT_FOUND` even though handlers and OpenAPI entries existed. Fix: restore `httpRoutes` (catalog + finance groups, `loadHandlersFromPackage: true`) and run `pnpm run generate:workspace-registry`.

**VS-04 fix (2026-06-22):** `/me/registrations` SSR — `fetchMemberRegistrations` (session cookie → `GET /bookings?view=mine`). E2E: SMK-PTL-02.

**Behavioral proof (2026-06-22):** After fix — `denali-catalog.spec.ts` 5/5 · `apps/marketing` `test:smoke` 4/4 · `apps/portal` `test:smoke` 3/3 (SMK-PTL-01/02/04) → **GUEST_SLICE_OK** + **VS-04/05**.

**VS-05 fix (2026-06-22):** Portal receipt BFF: multipart → `fileKey` → `POST /bookings/{registrationId}/receipts`. JWT `workspace_id` → `x-workspace-id`. E2E: SMK-PTL-04 · API: `p6-member-receipt-flow.spec.ts`.

**VS-01 (honest):** E2E `p6-admin-publish-smoke.spec.ts` SMK-P6-VS-01 proves **catalog visibility** (active listed · draft hidden) after dev seed — **not** admin wizard UI publish. Publish transition: `p6-vs01-admin-publish.spec.ts` (in-memory API).

**VS-06/07 (2026-06-22):** VS-06 — `bookings-ops.spec.ts` API-9.5-01 + E2E SMK-P9-04. VS-07 — `p6-member-receipt-flow` P6-MR-03 + E2E `p6-operator-receipt-approve-smoke.spec.ts` SMK-P6-ADM-02 (member API seed → finance tab approve). Postgres depth: `pnpm run p6:staging-gate` when `DATABASE_URL` set.

**P6-0 host bind (2026-06-22):** `smoke-p6-host-bind.mjs` runs during operator E2E server bootstrap (`smoke-operator-e2e-servers.mjs`) — `P6_HOST_BIND_SMOKE_OK` before browser smokes.

**P6-4 closure (2026-06-22):** `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK` (product gate + VS-01 + portal + marketing + SMK-P6-ADM-02 + SMK-P9-04). VS-08 E2E_PASS.

**Bundle A upgrades (2026-06-22):**

| Spec | Before | After |
| ---- | ------ | ----- |
| `portal-member-registrations` | `readFileSync` string match | Contract guards + `mergeCatalogRegistrationHeaders` unit (Next route needs request scope) |
| `portal-member-receipt-bff` | `readFileSync` string match | Route contract (401/400) + `mergeCatalogRegistrationHeaders` unit |
| `p6-guest-slice` | Flow.tsx marker read | `buildDevPortalPublicBaseUrl` + e2e gate wiring |
| `marketing-catalog-revalidate` | Not in `p6:gate` | Added to `p6-denali-product-gate.sh` (P6-1-N-008) |

**Portal smoke expansion (2026-07-02):** `apps/portal` `test:smoke` grew **3/3 → 14/14** — added DEN-PROF-01..03, DEN-INTAKE-01..03, SMK-PTL-05, SMK-PTL-06 (logout), and DEN-TRANS-01..03 (card-driven transport intake). Flake fixes: `portal-smoke-global-setup.ts` warms `/catalog/[tourId]/register` for tours 210/212/213/214 (first dev compile can exceed 90s > navigationTimeout), `member-profile-form.tsx` gates save on hydration (`data-member-profile-ready`), `MemberLogoutButton` gates click (`data-public-auth-logout-ready`), smoke servers pin `MARKETING_PUBLIC_BASE_URL` to portal `/health` (post-logout `/` must not chase marketing `:3002`), SMK-PTL-06 asserts middleware `307`/`401` instead of full browser goto to `/me/registrations`.

**Transport E2E + MEM-04 + staging seed (2026-07-02):** Two new smoke tours carry canonical `transport.*` — `…000213` (`bus` + `allowPersonalCar` + `transportCost`) and `…000214` (`shared_cars` + `dongAmount`). `portal-registration-transport-smoke.spec.ts` (DEN-TRANS-01..03) reads the outgoing `POST /api/catalog/registrations` body to prove `transport.kind` is omitted for organized-bus default, `personal_car` after opt-in, and `no_car_dong` for shared_cars — with **no** `pluginId==="denali"` branch in the portal. MEM-04 is proven by `apps/api/test/bookings-member-isolation.spec.ts`: `GET /bookings?view=mine` filters by `submittedByUserId`, so one member never sees another member's booking row. Staging parity: `seed-operator-smoke-published-tour.ts` now exposes `seedOperatorSmokeParticipantRequirementsTour` (…212) + `seedOperatorSmokeTransportTours` (…213/…214), wired into `ensure-operator-smoke-vs01-staging.ts` so Postgres staging carries all four published tours. Catalog count assertions (`DCAT-01`, `P6-VS-01-01`, `PW-DN-01`) updated `2 → 4`.

**Portal registration UI hardening (2026-06-30):**

| Layer | Change |
| ----- | ------ |
| Docs | `portal-registration-ui.md` · cross-refs in `public-catalog.md`, `host-subdomain-map.md`, `platform-portal-otp-flow.mdoc` |
| Theming | `denali-portal.css` MASTER tokens + Calistoga in portal layout |
| Guard | M17 incl. SDK catalog + registration dispatch + guest BFF + env templates (dynamic count) |
| Dev | tracked `.env.local.example` · `!.env.local.example` · portal `allowedDevOrigins` · `apps/api/.env.local.example` for Postgres |
| Proof | `guard:public-catalog-m17` dynamic PASS · SDK-CAT + registration intake specs in `p6:gate` + `p4:gate` · portal unit · smokes 4/4 each |

---

## Closure honesty matrix

| Layer | Claim | Actual truth |
| ----- | ----- | ------------ |
| Doc pack 58 nanos | ✅ COMPLETE | ✅ Specs/runbooks exist |
| `p6:gate` | Product gate | ✅ Unit/static + in-memory API + handler tests |
| `p6:e2e-gate` | Browser smokes | ✅ VS-01..07 + `P6-VS-CHAIN-B01` browser chain |
| VS-01 | Publish | ✅ SMK-P6-VS-01 catalog visibility + `p6-vs01-admin-publish` + LC-04/LC-06 lifecycle |
| P6-1-N-008 revalidate | Checklist ✅ | ✅ `marketing-catalog-revalidate.spec.ts` in `p6:gate` |
| Live 4-app stack | Host bind | ✅ In operator smoke bootstrap |
| Chained vertical slice | Implied | ✅ API `P6-VS-CHAIN-01` + browser `P6-VS-CHAIN-B01` |
| Postgres finance | `finance-ops.spec.ts` | ✅ `p6:staging-gate` + `p6:staging-preflight` verified 2026-06-22 (local Postgres) |
| Staging deploy | P6-4-N-006 tick | ✅ wiring verify `p6:staging-deploy-verify` · live deploy = ops/P7 |
| Portal public-auth BFF | Handler tests | ✅ in `p6:gate` (`portal-public-auth-bff.spec.ts`) |
| P7 prerequisite | P6 closed | ✅ Unblocked for charter work |

---

## Code that exists (reuse — do not rebuild)

| Surface | Path | Proof tier today |
| ------- | ---- | ---------------- |
| Marketing catalog | `apps/marketing/app/tours/` | Unit + marketing smoke in e2e gate |
| Portal register | `public-catalog-registration-flow.tsx` | E2E SMK-PTL-01 |
| Portal public-auth BFF | `apps/portal/app/api/public-auth/*` | Handler tests in `p6:gate` ✅ |
| Member `/me` BFF | `app/api/me/registrations/route.ts` | Handler 401 in portal gate |
| Bookings ops | `apps/api/src/bookings/` | In-memory HTTP in gate |
| Host parity API | `p6-host-tenant-parity.spec.ts` | In-memory listener ✅ |
| Denali plugin | `packages/workspaces/denali/` | Platform phase-6 package tests |
| Catalog revalidate | `marketing-catalog-revalidate.spec.ts` | In `p6:gate` ✅ |

---

## Remaining deferred (P7 / ops only)

| Item | Tier today | Owner |
| ---- | ---------- | ----- |
| Wizard publish E2E | Lifecycle + catalog API in gate | P7 — full wizard PATCH E2E blocked by composite validation |
| MinIO live upload | `fileKey` body in R1 | P7 — [p7-receipt-minio-staging.md](../../phase-20/p7/runbooks/p7-receipt-minio-staging.md) |
| Staging deploy executed | Runbook + wiring verify | Ops — [staging-deploy.md](../runbooks/staging-deploy.md) |

Accepted static guards (not hollow — anti-delete / wiring meta): `p6-preservation-gate` · `platform-denali-first-customer-exit` EX-P6-01..07.

---

## Behavioral exit criteria (met 2026-06-22)

| ID | Proof required | Command |
| -- | -------------- | ------- |
| P6-0 live | Same `tenantId` on 3 hosts | `TOUR_OPS_API_URL=http://127.0.0.1:3001 node scripts/smoke-p6-host-bind.mjs` ✅ |
| P6-1 | Guest register E2E | `p6:e2e-gate` / portal+marketing smoke |
| P6-2 | Operator approve | `bookings-ops` + E2E SMK-P9-04 / SMK-P6-ADM-02 |
| P6-3 | `/me` + receipt | Portal BFF handler + `p6-member-receipt-flow` |
| P6-4 | Exit | Static + e2e gate | `pnpm run p6:e2e-gate` ✅ |

---

## Agent rules (updated)

```yaml
forbidden:
  - "58/58 behavioral without proof tier"
  - "VS-01 = wizard UI publish E2E"
  - "Start P7 while vertical_slice chained E2E is required for your milestone"
required:
  - "Cite proof tier (E2E / API_MEMORY / STATIC / DOC) per nano"
  - "p6:gate after every code touch"
  - "Update this ledger when upgrading a spec tier"
```

---

## P7 handoff (staging proof required)

P6 **dev/E2E closure** does not replace P7 staging proof. Before T4 sign-off:

| P7 tier | Command | Evidence |
| ------- | ------- | -------- |
| T1 | `pnpm run p7:gate` | CI on PR |
| T1+ | `pnpm run p7:staging-gate` | [P7-EVIDENCE-PACK.md](../../phase-20/p7/appendices/P7-EVIDENCE-PACK.md) |
| T2 | [p7-staging-e2e.md](../../phase-20/p7/runbooks/p7-staging-e2e.md) | `staging-e2e.log` |
| T4 | [p7-customer-sign-off.md](../../phase-20/p7/runbooks/p7-customer-sign-off.md) | `manifest.yaml` |

Exit rubric: [P7-EXIT-CRITERIA-98.md](../../phase-20/p7/appendices/P7-EXIT-CRITERIA-98.md).

---

## Formal closure tracker (fast-close 2026-06-23)

**Authority:** [p6-fast-close.yaml](../p6-fast-close.yaml) · [p6-remaining-checklist.md](../p6-remaining-checklist.md)

| Track | Status |
| ----- | ------ |
| E VPS hygiene | E1/E2 done · E3 deferred ops |
| A Staging deploy | Infra done (lite) · A7/A8 full gates **P7** |
| B VS gaps | deferred **P7** |
| C/D Honest ticks + hollow specs | deferred **P10** |
| Long commands | [TEMP/FOR YOU.md](../../../TEMP/FOR%20YOU.md) |

**Bootstrap (fast, no build):** `bash scripts/vps-deploy/bootstrap-staging.sh` on VPS after rsync.

---

## References

- [p6-remaining-checklist.md](../p6-remaining-checklist.md) — formal closure SoT
- [TRACEABILITY-MATRIX-P6.md](TRACEABILITY-MATRIX-P6.md) — nano → file map (doc complete)
- [../runbooks/p6-e2e-smoke.md](../runbooks/p6-e2e-smoke.md)
- [../../phase-20/p7/AGENT-CURRENT-PHASE.yaml](../../phase-20/p7/AGENT-CURRENT-PHASE.yaml) — P7 unblocked after P6 closure
