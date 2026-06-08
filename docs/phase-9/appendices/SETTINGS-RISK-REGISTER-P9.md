# Phase 9.6 — Settings Module Registry · Risk Register

```yaml
register_id: SETTINGS-RISK-REGISTER-P9
version: "2026-06-08-v1"
authority: DEC-P9-009 · DEC-P9-010 · SETTINGS-MODULE-REGISTRY.md
subphase: "9.6"
workspace_primary: denali
review_cycle: each PR touching apps/api/src/settings/** · packages/workspaces/denali/src/settings/**
external_research:
  - title: Multi-tenant isolation (RLS + tenant_id)
    url: https://clerk.com/blog/multi-tenant-vs-single-tenant
  - title: JSONB vs columns at SaaS scale
    url: https://voxire.com/blog/postgresql-jsonb-vs-relational-saas-go/
  - title: JSONB with versioning
    url: https://danlevy.net/the-jsonb-seduction/
  - title: Tenant isolation not only in app code
    url: https://dev.to/pecrodrigues/why-tenant-isolation-should-not-live-only-in-application-code-1i6b
  - title: Plugin manifest before execution
    url: https://auditbuffet.com/patterns/ab-002090
```

> **Purpose:** Every identified risk for the Settings Module Registry has a **locked mitigation** and **verification artifact**. No «monitor» without a test or guard.

---

## Risk scoring

| Severity        | Definition                                                            |
| --------------- | --------------------------------------------------------------------- |
| **S1 Critical** | Cross-tenant data leak · Urban owner regression · platform-core creep |
| **S2 High**     | Stale wizard config · broken tour FK · unauthorized mutation          |
| **S3 Medium**   | UX drift · manifest load failure · performance regression             |
| **S4 Low**      | Doc drift · naming inconsistency                                      |

**Residual target:** No S1 open at 9.6 merge · S2 covered by spec + SMK.

---

## Register (Denali + platform)

| ID           | Risk                                                                 | Sev | Legacy root cause                                | **Definitive mitigation (LOCKED)**                                                                                                                                                                             | Verification                                                           |
| ------------ | -------------------------------------------------------------------- | --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **R-P9-S01** | Cross-tenant read/write via wrong `moduleId` or missing tenant scope | S1  | Ad-hoc Nest controllers · inconsistent filters   | **DEC-P9-010:** every mutation runs inside `runWithHttpRequestContext` with kernel `tenant_id`; Prisma RLS on all reference tables; handler rejects `moduleId` not in **resolved workspace manifest** for host | `settings-resources.spec.ts` cross-tenant · RLS integration            |
| **R-P9-S02** | JSONB config without version → silent shape drift · wizard break     | S2  | Monolithic tenant config blob                    | **DEC-P9-010:** `tenant_config(config_key, config_version, payload)`; Zod validate on PUT; Lime-style migration function per key; reject unknown version                                                       | `settings-config-version.spec.ts`                                      |
| **R-P9-S03** | Generic-only storage breaks tour FK (destinations · themes)          | S2  | Mixed catalog in `settings-locations` god module | **DEC-P9-010 hybrid:** reference entities = **normalized Prisma tables** with FK; generic router dispatches to entity repo — **not** one JSON blob per row for catalog                                         | `settings-modules.spec.ts` FK assert · tour create uses destination id |
| **R-P9-S04** | Urban admin gains Denali-style settings (`isAdminOrOwner`)           | S1  | Legacy RBAC scatter                              | **RULE-P9-002:** Urban manifest empty or owner-only entries; `GET/PATCH /urban/settings` unchanged; hub hides Denali modules on urban host                                                                     | `urban-settings-patch.spec.ts` at 9.8                                  |
| **R-P9-S05** | Settings business logic lands in `platform-core`                     | S1  | Legacy lift-and-shift temptation                 | **INV-P9-001:** validation hooks + defaults in `packages/workspaces/denali/src/settings/`; API handlers thin adapters only                                                                                     | `phase-9.contract.spec.ts` platform-core diff empty                    |
| **R-P9-S06** | Static `@app-tour/workspace-denali` import in `(app)/settings/**`    | S2  | Legacy direct imports                            | **TQ-P9-002:** only `workspace-plugin-loaders.generated.ts` + `features/settings/registry` may load manifest; pages import feature slice only                                                                  | `guard:import-boundary` · depcruise                                    |
| **R-P9-S07** | Unknown / tampered `moduleId` executes handler                       | S2  | No manifest contract                             | **DEC-P9-009:** manifest validated at plugin load (`validateSettingsManifest`); API 404 `SETTINGS_MODULE_UNKNOWN` before DB                                                                                    | SDK unit test · API-9.6-01                                             |
| **R-P9-S08** | Wizard template save without cache bust                              | S2  | Legacy cache inconsistency                       | **DEC-P9-005:** PUT config → `invalidateTenantConfig(tenantId, key)` **before** 200; wizard read uses effective resolver post-invalidate                                                                       | SMK-P9-05 · `settings-template.spec.ts`                                |
| **R-P9-S09** | Per-panel RBAC drift (legacy `isLeaderRole` naming)                  | S2  | Copy-paste panels                                | **DEC-P9-015:** actors = owner/admin/member only; single CASL map `operator.settings.{moduleId}` from manifest `ability`; legacy `isLeaderRole()` = owner **or** admin — not a persisted role                  | `operator-ability.spec.ts` matrix rows                                 |
| **R-P9-S10** | Generic CRUD insufficient (wizard builder · audit explorer)          | S3  | Forcing one UI for all                           | Manifest `uiVariant`: `generic_crud` \| `schema_form` \| `custom`; only 2 custom panels in 9.6                                                                                                                 | COP 9.6 pass criteria                                                  |
| **R-P9-S11** | Manifest nav drift (legacy hub/subnav mismatch)                      | S3  | Hardcoded links                                  | Dynamic nav from manifest `nav.group`; contract spec asserts hub links ⊆ manifest                                                                                                                              | `phase-9.contract.spec.ts`                                             |
| **R-P9-S12** | Noisy neighbor on settings writes                                    | S3  | Unbounded list endpoints                         | Paginated list · indexed `(tenant_id, module)` · tenant tier rate limit (Phase 7.6)                                                                                                                            | TQ-P9-005 EXPLAIN in COP                                               |
| **R-P9-S13** | Audit trail write path mixed with config                             | S3  | Observability in settings hub                    | Audit = **read-only** API; mutations go through outbox/audit emitter on resource/config PUT                                                                                                                    | `settings-audit-trail.spec.ts` read-only assert                        |

---

## Decision cross-reference

| Decision                                      | Risks closed                   |
| --------------------------------------------- | ------------------------------ |
| **DEC-P9-009** Registry + manifest validation | R-P9-S07 · R-P9-S11 · R-P9-S09 |
| **DEC-P9-010** Hybrid storage model           | R-P9-S01 · R-P9-S02 · R-P9-S03 |
| **DEC-P9-005** Cache invalidation             | R-P9-S08                       |
| **INV-P9-001**                                | R-P9-S05                       |
| **RULE-P9-002**                               | R-P9-S04                       |

---

## Denali-specific notes

| Module                 | Primary risk | Mitigation highlight                                             |
| ---------------------- | ------------ | ---------------------------------------------------------------- |
| `equipment`            | R-P9-S01     | Pilot module for generic CRUD · normalized `workspace_equipment` |
| `locations`            | R-P9-S03     | Separate `workspace_regions` · `workspace_destinations` with FK  |
| `tour_themes`          | R-P9-S03     | Referenced by presets · indexed slug per tenant                  |
| `tour_presets`         | R-P9-S02     | JSON **defaults** column versioned; theme_id FK column           |
| `tour_wizard_template` | R-P9-S08     | `tenant_config` key `wizard_template` · config_version ≥ 1       |
| `audit_trail`          | R-P9-S13     | Read-only · no PUT on explorer                                   |

---

## PR checklist (9.6)

- [ ] `moduleId` in manifest matches Prisma entity or config key registry
- [ ] No new import from `@app-tour/workspace-denali` outside allowlist
- [ ] Cross-tenant spec added or extended for new module
- [ ] Urban regression bundle unchanged (admin **403** on `/urban/settings`)
- [ ] IMPLEMENTATION-TRUTH row for 9.6 unchanged unless behavioral proof lands

---

## Escalation

| Condition                        | Action                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| New S1 risk discovered           | Stop merge · update this register + DEC waiver if mitigation changes   |
| Generic CRUD cannot model module | Add `uiVariant: custom` + COP waiver — **not** legacy port whole panel |
| JSONB field queried in WHERE     | **DEC-P9-010 promotion rule:** extract column in next migration        |
