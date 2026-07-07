
# P5 — Denali safety covenant

```yaml
phase: P5
mandatory: true
extends: TEMP/p3/p3-denali-safety.md
guard: pnpm run guard:p3-denali-covenant
preservation: TEMP/p5/PRESERVATION-CHECKLIST.md
```

## Priority (Architect + user 2026-06-21)

**Preserve Denali operator product:** wizard · clone · template · tour list · settings · finance receipts. Metadata cutover copies **field layout** to DB — does **not** remove package logic.

## Rules

| Rule | Detail |
|------|--------|
| R0 | Run `PRESERVATION-CHECKLIST.md` PC-01..10 before merge |
| R1 | **Forbidden:** `field-registry/`, `rules/`, `composites/`, `denali.plugin.ts`, `denali-plugin-adapter.ts` |
| R2 | **Allowed overlay:** `src/ui/`, theme, manifest, README, exports, draft, photos, clone |
| R3 | **Rules/composites stay in package.** Metadata DB holds layout + ruleSet **copy** for runtime merge — **never delete** package `rules/` |
| R4 | Lifecycle hooks → `apps/api/src/canonical/` or workspace hook — **not** Denali `rules/` edits |
| R5 | Denali payment = **`offline_receipt` fixed** — P5-C does not apply to Denali tenants |
| R6 | Finance receipts stay on Denali HTTP routes — no PSP stub in wizard |
| R7 | `guard:p3-denali-covenant` every PR |
| R8 | Gate scripts use scoped guard (P5-A-N-001) |

## AI anti-patterns (STOP)

- "Port rules to metadata" by deleting `denali/src/rules/`
- "Simplify wizard" by removing composites
- "Commerce config" changing Denali to gateway
- Inventing cutover DB columns or audit action names
