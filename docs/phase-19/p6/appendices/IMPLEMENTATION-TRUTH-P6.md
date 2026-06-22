# P6 — Implementation truth (honest ledger)

```yaml
truth_id: IMPLEMENTATION-TRUTH-P6
snapshot_version: "2026-06-22-closure-v2"
pack_version: "2.2"
status: COMPLETE
doc_pack: COMPLETE
code_integration: BEHAVIORAL_COMPLETE
gate_static: pnpm run p6:gate
gate_e2e: pnpm run p6:e2e-gate
gate_staging: pnpm run p6:staging-gate
gate_live: node scripts/smoke-p6-host-bind.mjs
```

> **2026-06-22 closure:** VS-01..08 behavioral proof · `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK`. Prior doc-only COMPLETE superseded by this ledger.

### 2026-06-22 — SMK-MKT-03 root cause (P6-1-N-014)

`packages/workspaces/denali/workspace.manifest.json` was missing the Phase 14 `httpRoutes` block. Codegen therefore emitted **urban-only** `workspace-http-routes.generated.ts` — `GET /denali/catalog` and finance routes returned host `NOT_FOUND` even though handlers and OpenAPI entries existed. Fix: restore `httpRoutes` (catalog + finance groups, `loadHandlersFromPackage: true`) and run `pnpm run generate:workspace-registry`.

**VS-04 fix (2026-06-22):** `/me/registrations` SSR — `fetchMemberRegistrations` (session cookie → `GET /bookings?view=mine`). E2E: SMK-PTL-02.

**Behavioral proof (2026-06-22):** After fix — `denali-catalog.spec.ts` 5/5 · `apps/marketing` `test:smoke` 4/4 · `apps/portal` `test:smoke` 3/3 (SMK-PTL-01/02/04) → **GUEST_SLICE_OK** + **VS-04/05**.

**VS-05 fix (2026-06-22):** Portal receipt BFF: multipart → `fileKey` → `POST /bookings/{registrationId}/receipts`. JWT `workspace_id` → `x-workspace-id`. E2E: SMK-PTL-04 · API: `p6-member-receipt-flow.spec.ts`.

**VS-01 (2026-06-22):** E2E `p6-admin-publish-smoke.spec.ts` SMK-P6-VS-01 (active listed · draft hidden) + API `p6-vs01-admin-publish.spec.ts` P6-VS-01-01/02. Operator smoke JWT: ephemeral bootstrap in `smoke-operator-e2e-servers.mjs`.

**VS-06/07 (2026-06-22):** VS-06 — `bookings-ops.spec.ts` API-9.5-01 + E2E SMK-P9-04. VS-07 — `p6-member-receipt-flow` P6-MR-03 + E2E `p6-operator-receipt-approve-smoke.spec.ts` SMK-P6-ADM-02 (member API seed → finance tab approve). Postgres depth: `pnpm run p6:staging-gate` when `DATABASE_URL` set.

**P6-0 host bind (2026-06-22):** `smoke-p6-host-bind.mjs` runs during operator E2E server bootstrap (`smoke-operator-e2e-servers.mjs`) — `P6_HOST_BIND_SMOKE_OK` before browser smokes.

**P6-4 closure (2026-06-22):** `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK` (product gate + VS-01 + portal + marketing + SMK-P6-ADM-02 + SMK-P9-04). VS-08 E2E_PASS.

---

## Closure honesty matrix

| Layer | Prior claim | Actual truth |
| ----- | ----------- | ------------ |
| Doc pack 58 nanos | ✅ COMPLETE | ✅ Still true — specs/runbooks exist |
| `p6:gate` | VS-08 PASS | ✅ Product gate (unit/static + in-memory API) |
| `p6:e2e-gate` | — | ✅ Browser smokes (web · portal · marketing) 2026-06-22 |
| Live 4-app stack | Implied done | ✅ Host bind in operator smoke bootstrap · manual `smoke-p6-host-bind.mjs` also valid |
| E2E VS-01..07 | Checklist ✅ | ✅ VS-01..07 E2E (VS-01 catalog visibility; publish UI transition = API `p6-vs01-admin-publish`) |
| P7 prerequisite | P6 closed | ✅ **Unblocked** |
| CI | — | ✅ `p6-denali-gate.yml` — product on PR · E2E weekly · staging manual |

---

## Code that exists (reuse — do not rebuild)

| Surface | Path | Proof tier today |
| ------- | ---- | ---------------- |
| Marketing catalog | `apps/marketing/app/tours/` | Unit fetch · **no E2E in gate** |
| Portal register | `public-catalog-registration-flow.tsx` | Contract strings · BFF partial |
| Portal public-auth BFF | `apps/portal/app/api/public-auth/*` | 2 route tests · **not in p6:gate** |
| Member `/me` BFF | `app/api/me/registrations/route.ts` | Static read in gate |
| Bookings ops | `apps/api/src/bookings/` | In-memory HTTP in gate |
| Host parity API | `p6-host-tenant-parity.spec.ts` | In-memory listener ✅ |
| Denali plugin | `packages/workspaces/denali/` | Platform phase-6 package tests |

---

## Hollow gate evidence (fixed in 2.2)

| Spec | Problem | Remediation |
| ---- | ------- | ----------- |
| `p6-guest-slice` GS-03/04 | Asserted **mdoc/runbook** text | Removed — replaced with BFF import test |
| `platform-denali-first-customer-exit` | Asserted gate script + DOC-SYNC exist | Keep as wiring only — not behavioral |
| `p6-preservation-gate` | `readFileSync` non-empty + safety doc | Keep as anti-delete guard only |
| `portal-member-registrations` | String match on route file | Upgrade to route handler test (planned) |

---

## Behavioral exit criteria (met 2026-06-22)

| ID | Proof required | Command |
| -- | -------------- | ------- |
| P6-0 live | Same `tenantId` on 3 hosts | `TOUR_OPS_API_URL=http://127.0.0.1:3001 node scripts/smoke-p6-host-bind.mjs` ✅ 2026-06-22 |
| P6-1 | Guest register E2E | `p6:e2e-gate` / portal+marketing smoke |
| P6-2 | Operator approve | `bookings-ops` + manual or integration with Postgres |
| P6-3 | `/me` + receipt | Portal BFF integration test with API |
| P6-4 | Exit | Static + e2e gate | `pnpm run p6:e2e-gate` ✅ 2026-06-22 |

---

## Agent rules (updated)

```yaml
forbidden:
  - "P6 done because p6:gate green"
  - "Start P7 while vertical_slice is DOC_ONLY"
  - "Re-close P6 without VS-01..07 behavioral row"
required:
  - "Update AGENT-CURRENT-PHASE.yaml after each live proof"
  - "p6:gate after every code touch"
  - "smoke-p6-host-bind when API running"
```

---

## References

- [TRACEABILITY-MATRIX-P6.md](TRACEABILITY-MATRIX-P6.md) — nano → file map (doc complete)
- [../runbooks/p6-e2e-smoke.md](../runbooks/p6-e2e-smoke.md)
- [../../phase-20/p7/AGENT-CURRENT-PHASE.yaml](../../phase-20/p7/AGENT-CURRENT-PHASE.yaml) — P7 unblocked after P6 closure
