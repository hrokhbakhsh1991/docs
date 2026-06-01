# Migration Final Status — Template Canonical Data

**Generated:** 2026-06-01  
**Script:** `pnpm --filter @apps/api migrate:template-canonical`  
**Target table:** `workspace_tour_wizard_templates.canonical_data`

---

## Summary

| Metric | Count |
|--------|------:|
| **Total Rows** | **3** |
| **Fixed Rows** (would update / applied) | **0** |
| **Unchanged Rows** | **3** |
| **Quarantined Rows** | **0** |

**Outcome:** Migration complete — no `--apply` run required. All rows are already Layer A compliant.

---

## Execution Log

### Step 1 — Dry-run (default)

```bash
pnpm --filter @apps/api migrate:template-canonical
```

```
migrate-template-canonical-data: dryRun=true
```

**Final dry-run report (from script stdout):**

```json
{
  "generatedAt": "2026-05-31T22:46:05.522Z",
  "dryRun": true,
  "scanned": 3,
  "updated": 0,
  "unchanged": 3,
  "quarantined": 0,
  "rows": []
}
```

### Step 2 — Per-row dry-run detail

| Row ID | Workspace ID | Status | Changed |
|--------|--------------|--------|---------|
| `5ee26021-cf4b-4944-8240-9cea31d190b4` | `2a61927b-1816-4e39-ae0f-d398bbdd40e5` | unchanged | no |
| `4931f36a-19ed-4cd1-9ec3-eb5d12eaf7f6` | `a0dcacb3-b6da-430f-86e1-5e36cb4c2113` | unchanged | no |
| `768660fa-47b2-45bf-8c9b-50da3cf4b5fa` | `fd3bd26d-d267-4b0f-a7a2-ca696e7f6246` | unchanged | no |

All three rows have `canonical_data: {}` before and after normalization — valid empty canonical, no fossil keys to strip.

### Step 3 — `--apply` decision

**Skipped.** Dry-run reported `updated: 0` (no “Valid but Changed” rows). Running `--apply` would perform zero `UPDATE` statements.

### Step 4 — Quarantine

**None.** `quarantined: 0` — no `quarantine.json` written. Execution was not blocked.

---

## Compliance Notes

- Empty `{}` canonical passes `resolveStoredTemplateCanonical` (Zod deep-partial) but will fail **instantiate** with `hydration_empty` until seed values are configured (see `reports/hydration-failure-analysis.md`).
- Service layer and UI hardening remain authoritative for runtime validation; this migration only normalizes persisted JSONB.

---

## Commands Reference

```bash
# Dry-run (no writes)
pnpm --filter @apps/api migrate:template-canonical

# Apply fixes (only when dry-run shows updated > 0)
pnpm --filter @apps/api migrate:template-canonical -- --apply

# Read-only integrity audit
pnpm --filter @apps/api audit:template-canonical-integrity
```

---

*End of migration final status report.*
