# P2 — Enterprise Ops · Execution Index (Super Admin–first)

```yaml
doc_id: P2-EXECUTION-INDEX
version: 2.0-aligned
status: complete
completed: 2026-06-21
prerequisite: TEMP/p1-exit-checklist.md ✅
north_star: Platform Control Center @ admin.{PLATFORM_ROOT_DOMAIN}
denali_covenant: TEMP/p2/p2-denali-safety.md (read before any code)
exit: TEMP/p2-exit-checklist.md
summary: TEMP/p2-enterprise-ops.md
nano_tasks_total: 142
nano_tasks_done: 142
agent_entry: —
denali_gate: pending — P0 legacy diff in packages/workspaces/denali (not from P2 EPICs)
```

---

## P2 complete — EPIC summary

| Order | EPIC | Nano | Status | Doc |
|-------|------|------|--------|-----|
| 1 | P2-B Impersonation | 30 | ✅ | [platform-impersonation.mdoc](../../docs/phase-15/platform-impersonation.mdoc) |
| 2 | P2-C Billing | 32 | ✅ | [platform-billing-plans.mdoc](../../docs/phase-15/platform-billing-plans.mdoc) |
| 3 | P2-D Domains/SSL | 32 | ✅ | [platform-domains-ssl.mdoc](../../docs/phase-15/platform-domains-ssl.mdoc) |
| 4 | P2-E Offboard | 32 | ✅ | [platform-offboard-compliance.mdoc](../../docs/phase-15/platform-offboard-compliance.mdoc) |
| 5 | P2-A Gateway | 16 | ✅ | [platform-mother-site.mdoc](../../docs/phase-15/platform-mother-site.mdoc) |

---

## وضعیت کد (2026-06-21)

### P2 پیاده‌شده ✅

| EPIC | API / Web outcome |
|------|-------------------|
| P2-B | `POST .../impersonate` · Owner tab · readonly banner · audit START/END |
| P2-C | `platform_plans` · `tenant_subscriptions` · Billing tab · `custom_domain` gate |
| P2-D | SSL columns · live DNS verify · SSL badges · ingress custom host · Overview KPI |
| P2-E | offboard/cancel/export/purge · danger zone · audit CSV · operator block on `offboarding` |
| P2-A | `apps/marketing` apex/www gateway + maintenance · club paths unchanged |

### Verification (fast-track)

```bash
pnpm run guard:import-boundary                    # PASS
pnpm --filter @apps/web exec node --import tsx --test test/platform-epic-c-boundary.spec.ts
pnpm --filter @apps/marketing test                 # 39/39
git diff --quiet packages/workspaces/denali        # FAIL — isolate P0 before P2 PR
```

Heavy gates (`p1:gate`, `p1:e2e-gate`, `test:changed`) — run on Architect YES before merge.

---

## ترتیب اجرا (frozen — done)

```text
P2-B → P2-C → P2-D → P2-E → P2-A  (142 nano-tasks)
```

Spec files remain source of truth for nano IDs and file manifests.

---

## نقشه دامنه

```text
app-tour.ir / www          → gateway + maintenance (P2-A) ✅
admin.app-tour.ir          → Super Admin ★ P2 core ✅
{club}.app-tour.ir         → maintenance OK until P3
{club}.portal.app-tour.ir  → maintenance OK until P3
{club}.admin.app-tour.ir   → Denali operator · impersonate target (P2-B) ✅
```

---

## فایل‌های کد کلیدی

```text
apps/api/src/platform/                          # P2 extensions
apps/api/src/routes/platform/                   # impersonate, billing, ssl, offboard, audit export
apps/web/src/platform/club-detail/              # Billing, Domains SSL, danger zone tabs
apps/marketing/src/platform/                    # P2-A mother site only
docs/phase-15/platform-*.mdoc                 # P2 technical docs
```

---

## Known gaps (post-P2)

1. **Denali gate** — `packages/workspaces/denali` has uncommitted P0 work; P2 covenant held (no P2 edits to denali).
2. Tour publish → marketing catalog — **P3+**
3. Portal registration E2E prod — **P3+**
4. Club marketing full product — maintenance OK

---

## Related docs

| Doc | Role |
|-----|------|
| [../ROADMAP-INDEX.md](../ROADMAP-INDEX.md) | کل فازها · P3 next |
| [../p2-exit-checklist.md](../p2-exit-checklist.md) | خروج فاز |
| [p2-denali-safety.md](./p2-denali-safety.md) | covenant |
| [../p3-metadata-platform.md](../p3-metadata-platform.md) | فاز بعد |
