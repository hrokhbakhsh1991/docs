# P7-1 — Wizard and settings completion (protect zone)

```yaml
epic: P7-1
nanos: 9
status: PLANNED
priority: 2
prerequisite: P7-0-N-005
zone: Z1 freeze + Z2 complete
exit_signal: VS-01 live on staging — customer tour publishStatus active
```

## Goal

**تکمیل آنچه در wizard/settings هست** — تور واقعی مشتری قابل ساخت، save، publish (`active`) بدون rebuild.

## Reality (trunk)

| Asset | وضعیت |
| ----- | ----- |
| `/tours/new` + Denali composites | پیاده · سنگین |
| rules · `denaliRuleModel` | پیاده — **دست نزن** |
| settings modules | trunk — audit blocker on staging |
| publish readiness | `validateDenaliPublishReadinessSync` — violations on empty draft |

---

## Nanos

### P7-1-N-001 — Walkthrough + blocker inventory

**Do:** Run [p7-wizard-blocker-walkthrough.md](runbooks/p7-wizard-blocker-walkthrough.md) on staging; record P0/P1/Z4 list.

**Files:** runbook · update IMPLEMENTATION-TRUTH-P7 blocker table

**Verify:** Numbered blocker list committed in runbook §Blockers

---

### P7-1-N-002 — Preservation gate on every PR

**Do:** Document regression commands for wizard PRs.

**Verify:**

```bash
pnpm run p7:gate
pnpm --filter @apps/web exec node --import tsx --test test/denali-publish-readiness.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/denali-wizard-draft-contract.spec.ts
```

---

### P7-1-N-003 — Staging tour create/save PATCH round-trip

**Do:** New tour on staging persists via Postgres (`STORAGE_DRIVER=prisma`); draft PATCH succeeds end-to-end.

**Files:** `apps/web/app/tours/new/` · `apps/api/src/tours/tours.service.ts`

**Verify:** Create tour on staging → refresh → draft retained · no 500 on save

**Blocker class:** P0 — infra/data path

---

### P7-1-N-004 — Customer settings seed (pickers + prefill)

**Do:** Staging Postgres has destinations, equipment, locations, and customer fixture rows wizard composites need — **one seed pass**, not duplicate nano work.

**Files:** `apps/api/scripts/db-seed.ts` · `apps/api/src/settings/` · settings modules under `apps/web/app/(app)/settings/`

**Verify:** Wizard pickers populated · new tour prefill matches customer fixtures · no empty-picker errors

**Blocker class:** P0 — data dependency (BLK-P7-02)

---

### P7-1-N-005 — Publish readiness violations visible in UI

**Do:** Operator sees rule/canonical violations before publish — not silent failure.

**Files:** `@app-tour/workspace-denali/ui/chrome/wizard-validation` · wizard host

**Verify:** Attempt publish on incomplete draft → actionable messages · `denali-publish-readiness.spec.ts` green

**Blocker class:** P0 — UX gate

---

### P7-1-N-006 — publishStatus active → marketing catalog

**Do:** PATCH publish to `active` on staging tour → marketing `/tours` lists row (revalidate path).

**Files:** `maybeScheduleMarketingCatalogRevalidate` · marketing catalog fetch

**Verify:** VS-01 + VS-02 on staging after publish

**Blocker class:** P0 — vertical slice

---

### P7-1-N-007 — Wizard draft session persistence

**Do:** `wizardSessionId` + draft envelope survive step navigation and page refresh on staging.

**Files:** `apps/web/src/tours/tour-wizard-draft.ts` · draft PATCH routes

**Verify:** `denali-wizard-draft-contract.spec.ts` · manual refresh mid-wizard on staging

**Blocker class:** P0 — operator UX

---

### P7-1-N-008 — Terms/conditions on real tour

**Do:** Canonical `terms` / conditions fields persist and display on published customer tour.

**Files:** denali canonical paths · wizard terms step

**Verify:** Published tour detail shows conditions · portal register intake receives terms

---

### P7-1-N-009 — VS-01 live proof on staging

**Do:** Customer tour `publishStatus: active` on staging admin; draft hidden from catalog until publish.

**Verify:** SMK-P6-VS-01 equivalent on staging URLs · checklist row VS-01 staging ✅

---

## FORBIDDEN

```text
❌ Move wizard into (app)/
❌ Delete/refactor denali rules/composites
❌ New wizard framework
❌ Gateway or payment mode changes
```

Carryover: [p6-denali-safety.md](../../phase-19/p6/p6-denali-safety.md)

## EPIC exit

VS-01 live: customer tour published on staging.

## References

- [wizard-experience.md](../../workspaces/denali/wizard-experience.md)
- [p7-wizard-blocker-walkthrough.md](runbooks/p7-wizard-blocker-walkthrough.md)
