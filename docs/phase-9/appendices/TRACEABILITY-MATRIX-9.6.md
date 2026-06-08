# Phase 9.6 — Settings registry traceability matrix

```yaml
matrix_id: TRACEABILITY-MATRIX-9.6
version: "2026-06-08-v1"
authority: SETTINGS-MODULE-REGISTRY.md · SETTINGS-RISK-REGISTER-P9.md
subphase: "9.6"
decisions: [DEC-P9-009, DEC-P9-010, DEC-P9-005]
```

| REQ / Risk     | Spec / DEC                    | Handler / surface           | Action   | Smoke / CP            | Spec file                         |
| -------------- | ----------------------------- | --------------------------- | -------- | --------------------- | --------------------------------- |
| **REQ-P9-060** | SETTINGS-MODULE-REGISTRY §5.1 | `settings/resources.*`      | P9-6-A01 | SMK-P9-08             | `settings-resources.spec.ts`      |
| **REQ-P9-061** | SETTINGS-MODULE-REGISTRY §6   | `features/settings/generic` | P9-6-A02 | SMK-P9-05 · SMK-P9-08 | `settings-generic-crud.spec.ts`   |
| **REQ-P9-062** | SETTINGS-RISK-REGISTER-P9     | DEC-P9-009/010 mitigations  | P9-6-A03 | CP-9.6-07..10         | `settings-config-version.spec.ts` |
| **R-P9-S01**   | DEC-P9-010                    | RLS + tenant kernel         | P9-6-A04 | CP-9.6-08             | `settings-resources.spec.ts`      |
| **R-P9-S07**   | DEC-P9-009                    | manifest allowlist          | P9-6-A01 | CP-9.6-07             | `settings-resources.spec.ts`      |
| **R-P9-S08**   | DEC-P9-005                    | config PUT + invalidate     | P9-6-A05 | SMK-P9-05             | `settings-template.spec.ts`       |
| **P9-F-007**   | INV-P8-007                    | urban owner settings        | P9-6-A06 | urban bundle          | `urban-settings-patch.spec.ts`    |
| **INV-P9-001** | platform-core zero            | denali/settings only        | —        | contract              | `phase-9.contract.spec.ts`        |

## SDK / Denali proof

| ID         | Artifact                      | Command                                                                        |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------ |
| SDK-9.6-01 | `validateSettingsManifest`    | `pnpm --filter @app-tour/workspace-sdk test test/settings-manifest.spec.ts`    |
| DN-9.6-01  | `denali-settings.manifest.ts` | `pnpm --filter @app-tour/workspace-denali test test/settings-manifest.spec.ts` |

## Module → manifest id map

| Legacy path                       | manifest `id`           | kind               |
| --------------------------------- | ----------------------- | ------------------ |
| `/settings/equipment`             | `equipment`             | reference_data     |
| `/settings/guide-languages`       | `guide_languages`       | reference_data     |
| `/settings/tour-themes`           | `tour_themes`           | reference_data     |
| `/settings/locations`             | `locations`             | reference_data     |
| `/settings/tour-presets`          | `tour_presets`          | reference_data     |
| `/settings/tour-wizard-template`  | `tour_wizard_template`  | tenant_config      |
| `/settings/tour-presets/advanced` | `tour_presets_advanced` | tenant_config      |
| `/settings/audit-trail`           | `audit_trail`           | readonly_explorer  |
| `/settings/me`                    | — (identity 9.1)        | account_preference |
