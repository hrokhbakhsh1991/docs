# Phase 7 — Cross-cutting actions

```yaml
cross_cutting_version: "2026-06-04-v1"
```

## P7-X-A01 — Record platform-core baseline SHA (7.2)

```yaml
description: Tag or record commit SHA before urban platform-core touch
when: start of 7.2
outputs:
  - reports/phase-7-genericity-baseline.yaml
validation:
  - baseline_sha set
  - git diff "${baseline_sha}" -- packages/platform-core empty at 7.2 DoD
```

## P7-X-A02 — Urban anti-rail static guard

```yaml
description: Ensure web wizard config never maps urban to denali rail
validation:
  - rg 'urban.*denali|denali.*urban' apps/web/src/workspace --glob '!*.spec.ts' → no forbidden coupling
  - legacy anti-pattern documented in LEGACY-URBAN-REFERENCE.md L workspace-wizard.config.spec.ts:11-38
forbidden:
  - getWizardConfig("urban").wizardMode === "denali"
```

## P7-X-A03 — Update IMPLEMENTATION-TRUTH on subphase merge

```yaml
description: Flip repo_status row when behavioral proof lands
validation:
  - TRUTH row matches latest green verification command from req-p7-command-atlas
```
