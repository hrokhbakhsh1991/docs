# P7-1 — Wizard blocker walkthrough (staging)

```yaml
nano: P7-1-N-001
epic: P7-1
authority: ../p7-1-wizard-completion.md
prerequisite: P7-0-N-005
workspace: denali
route: /tours/new
staging_profile: B-staging
```

## Staging URLs (Profile B-staging · VPS `89.42.210.252`)

| Surface | URL | Host header (curl) |
| ------- | --- | ------------------ |
| Admin login | `http://89.42.210.252:23000/auth/login` | optional `operator.admin.localhost` |
| Wizard | `http://89.42.210.252:23000/tours/new` | **`Host: operator.admin.localhost`** |
| Marketing | `http://89.42.210.252:23002/tours` | `Host: operator.localhost` |
| Portal | `http://89.42.210.252:23003` | `Host: operator.portal.localhost` |

**OTP:** Profile B uses `AUTH_ALLOW_DEV_STATIC_OTP=true` — code **`1234`** for `09174070937` ([p7-sms-otp-staging.md](p7-sms-otp-staging.md)).

**Fast infra check before walkthrough:**

```bash
pnpm run p7:staging-remote-smoke
pnpm run p7:staging-operator-login
pnpm run p7:staging-wizard-probe   # expect FAIL until BLK-P7-00 fixed
```

**Fix BLK-P7-00 (rsync local `.next` — fast if BUILD_ID exists):**

```bash
pnpm run p7:sync-staging-web-rsync   # ~2–5 min
# or full rebuild:
pnpm run p7:sync-staging-web         # ~15–25 min
```

## Goal

One scripted operator path on **staging** to build a real customer tour from empty draft through `publishStatus: active`. Output: numbered blocker inventory (P0 / P1 / Z4).

---

## Preconditions

| Check | Evidence |
| ----- | -------- |
| P7-0 complete | staging login + seed + four processes |
| Operator session | admin host OTP |
| Postgres | `DATABASE_URL` on API |

---

## Walkthrough steps

| Step | Action | Expected | Record if fail |
| ---- | ------ | -------- | -------------- |
| 1 | Open `/tours/new` | Wizard Bridge shell loads | P0 — host/routing |
| 2 | Step through basics (title, category, dates) | Save PATCH 200 | P0 — N-003 |
| 3 | Open destination/equipment pickers | Options populated | P0 — N-004 |
| 4 | Complete required steps per stepper | No silent validation skip | P1 |
| 5 | Attempt publish on incomplete draft | Violations shown in UI | P0 — N-005 |
| 6 | Complete all required fields | Publish readiness ok | — |
| 7 | Set `publishStatus: active` | PATCH succeeds | P0 — N-006 |
| 8 | Confirm API revalidate env set | `MARKETING_REVALIDATE_*` on api + marketing | P0 — BLK-CAT-01 |
| 9 | Refresh mid-wizard (step 3) | Draft retained | P0 — N-007 |
| 10 | Marketing `/tours` | New tour listed after publish | P0 — N-006 |

---

## Blocker inventory (audit baseline — pack v1.4)

| ID | Class | Nano | Summary |
| -- | ----- | ---- | ------- |
| BLK-P7-00 | ~~P0~~ **cleared** | deploy | `p7:sync-staging-web-vps-build` · probe 200 · 2026-06-23 |
| BLK-P7-01 | P0 | N-003 | Staging tour create/save must persist via Postgres |
| BLK-P7-02 | ~~P0~~ **cleared** | N-004 | seed-denali-dev-catalog-staging · picker probe 2026-06-23 |
| BLK-P7-03 | ~~P0~~ **cleared** | N-005 | `p7:staging-publish-violations-probe` · 400 + 11 canonical paths · 2026-06-23 |
| BLK-P7-04 | P0 | N-006 | Active publish must revalidate marketing catalog |
| BLK-P7-05 | P0 | N-007 | Draft session must survive refresh on staging |
| BLK-CAT-01 | ~~P0~~ **cleared** | N-006 | `p7:configure-staging-revalidate` · catalog probe · revalidate 200 · 2026-06-23 |

Update this table after each staging walkthrough. Add rows for newly discovered P0 blockers; move polish items to Z4.

---

## Walkthrough results (fill on staging — required for N-001 exit)

```yaml
walkthrough_status: IN_PROGRESS
last_run: "2026-06-23"
staging_profile: B-staging
operator: agent-probe (09174070937)
probe_command: pnpm run p7:staging-wizard-probe
probe_host: denali.admin.localhost  # automated; manual customer path uses operator.admin.localhost
```

| Step | Pass? | Notes | Action |
| ---- | ----- | ----- | ------ |
| 1 Wizard shell | ✓ | HTTP 200 · `data-workspace-wizard` · `p7:sync-staging-web-vps-build` | BLK-P7-00 **cleared** |
| 2 Save PATCH | ✓ | PATCH 200 · GET round-trip retains title · `ws-denali-dev/drafts/operator.wizard/denali-create` | N-003 staging PASS |
| 3 Pickers populated | ✓ | destinations=3 · equipment=1 · tour_themes=1 · `p7:staging-picker-probe` · HTML `توچال` | N-004 staging PASS |
| 5 Publish violations | ✓ | POST `/tours` incomplete → HTTP 400 · `CANONICAL_VALIDATION_FAILED` · 11 paths · validation summary in bundle | N-005 staging PASS |
| 7 Publish active | ✓ | seed tour `…0210` · API catalog + marketing `/tours` | N-006 staging PASS |
| 8 Revalidate env | ✓ | `p7:configure-staging-revalidate` · POST `/api/revalidate` 200 | BLK-CAT-01 cleared |
| 9 Draft refresh | ✓ | `p7:staging-draft-refresh-probe` · step=2 · wizardSessionId + title x2 GET | N-007 staging PASS |
| 10 Catalog lists tour | ✓ | `North Ridge Trek` on `operator.localhost:23002/tours` | N-006 |

**Infra green (pre-walkthrough):** `p7:staging-remote-smoke` + `p7:staging-operator-login` PASS.

**Staging API note (2026-06-24):** If `p7:staging-publish-violations-probe` returns HTTP **500** on POST `/tours`, rebuild `@app-tour/platform-core` on VPS — stale `packages/platform-core/dist` loads before `src` and rejects `draftTombstone` functions. Run `bash scripts/p7-staging-sync-platform-core.sh` (also wired into publish-violations + e2e probe).

**Signed:** agent-probe **Date:** 2026-06-23

---

## Code audit anchors (static)

| Surface | Path |
| ------- | ---- |
| Wizard route | `apps/web/app/tours/new/page.tsx` |
| Denali client | `apps/web/app/tours/new/denali-create-tour-wizard-client.tsx` |
| Rules | `packages/workspaces/denali/src/rules/` |
| Publish validation | `@app-tour/workspace-denali/ui/chrome/wizard-validation` |
| Specs | `apps/web/test/denali-publish-readiness.spec.ts` · `denali-wizard-draft-contract.spec.ts` |

---

## Exit signal

Blocker table reviewed; P7-1-N-003..N-007 mapped to BLK-P7-01..05; Architect confirms P0 scope.

## References

- [wizard-experience.md](../../../workspaces/denali/wizard-experience.md)
- [IMPLEMENTATION-TRUTH-P7.md](../appendices/IMPLEMENTATION-TRUTH-P7.md)
