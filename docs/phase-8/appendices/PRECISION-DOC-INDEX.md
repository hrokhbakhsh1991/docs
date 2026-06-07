# Phase 8 — Precision doc index

```yaml
index_version: "2026-06-08-v2"
sole_entry: ../phase-8-agent-router.md
doc_pack_target: 96
files_on_disk: 39
pek_register: scripts/guards/lib/phase-8-doc-hardening.mjs
spec_registry: appendices/SPEC-REGISTRY-8.1.yaml
behavioral_ledger: ../audits/IMPLEMENTATION-TRUTH.md
guard_script: ../../../scripts/guards/phase-8-guard.mjs
charter_gates: 25
navigator: ../AGENT-NAVIGATOR.md
```

> Single source of truth for **every** PEK file under `docs/phase-8/`. Readiness states are **doc/structural** unless `IMPLEMENTATION-TRUTH` marks behavioral `VERIFIED_BEHAVIORAL`. Verification column names the **primary** automated or gate command that proves the file's contract.

## Readiness enum

| State               | Meaning                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `VERIFIED_SCAFFOLD` | On disk · structurally valid · consumed by `phase-8:guard` or subphase proof without behavioral code |
| `LOCKED_SPEC`       | Architect-approved decision or CASL matrix — change requires waiver                                  |
| `SPEC_ONLY`         | Executable subphase spec — implementation **ABSENT** on trunk                                        |
| `ABSENT_BEHAVIORAL` | Referenced artifacts (tests, routes) not on trunk — honesty per IMPLEMENTATION-TRUTH                 |
| `PLACEHOLDER_DIR`   | Directory reserved — no COP files yet                                                                |

---

## T0 — Sole entry & covenant

| Path                                                                        | Structural purpose                                                                                               | Readiness           | Verification target                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| [`AGENT-NAVIGATOR.md`](../AGENT-NAVIGATOR.md)                               | Decision tree · per-subphase bundles · failure modes · fast commands · sync obligation                           | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_agent_navigator_present`                                 |
| [`appendices/AGENT-CURRENT-PHASE.yaml`](AGENT-CURRENT-PHASE.yaml)           | Machine snapshot — `doc_ready` · `next_read` · `next_prove_with` · guard attestation                             | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_agent_navigator_present`                                 |
| [`phase-8-agent-router.md`](../phase-8-agent-router.md)                     | **SOLE execution entry** — routing law, ERIP mandate, read order, FAIL token, subphase DAG pointers              | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_boot_manifest` · `p8_truth_honesty`                      |
| [`phase-8-charter.md`](../phase-8-charter.md)                               | Human narrative — epic Option A + silo 8.3, TQ benchmarks, subphase exit signals, **non-authorizing** intent doc | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_boot_manifest` (charter path in manifest)                |
| [`appendices/BOOT-MANIFEST.yaml`](BOOT-MANIFEST.yaml)                       | Machine boot sequence · `detect_current_subphase` · hot_paths · gate_chain · `out_of_scope`                      | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_boot_manifest`                                           |
| [`audits/IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md)       | Honesty ledger — subphase `SPEC_ONLY`/`ABSENT` · package status · forbidden claims                               | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_truth_honesty`                                           |
| [`audits/verification-matrix.md`](../audits/verification-matrix.md)         | REQ-P8-001..053 · RULE-P8-_ · INV-P8-_ → CMD-P8-xxx refs (copy-paste blocks)                                     | `VERIFIED_SCAFFOLD` | [`verification-commands.md`](verification-commands.md) · `pnpm run phase-8:gate` at 8.5 |
| [`audits/DOC-EXECUTION-SCORECARD.md`](../audits/DOC-EXECUTION-SCORECARD.md) | Sprint A agent-readiness score · gaps to 95                                                                      | `VERIFIED_SCAFFOLD` | Manual review · `pnpm run phase-8:guard`                                                |
| [`phase-8-guards.md`](../phase-8-guards.md)                                 | Guard command reference · `p8_*` check matrix · fail tokens · CI/Husky wiring                                    | `VERIFIED_SCAFFOLD` | `node scripts/guards/phase-8-guard.mjs`                                                 |
| [`appendices/phase-7-bridge.md`](phase-7-bridge.md)                         | Phase 7 closure → 8.0 prerequisite table · explicit deferrals                                                    | `VERIFIED_SCAFFOLD` | `pnpm run phase-7:gate` · entry yaml `phase_7_gate.status: PASS`                        |
| [`appendices/adr-008.md`](adr-008.md)                                       | ADR-008 — Option A Product Parity + silo 8.3 subset                                                              | `LOCKED_SPEC`       | Charter adr front-matter · manual ADR citation in PR                                    |
| [`appendices/verification-commands.md`](verification-commands.md)           | Copy-paste safe verification commands per subphase 8.0–8.5                                                       | `VERIFIED_SCAFFOLD` | Row commands in verification-matrix · `pnpm run phase-8:guard`                          |

---

## T0 — Locked product & auth specs

| Path                                                                    | Structural purpose                                                                                                                                         | Readiness     | Verification target                                                                                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`appendices/IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) | **DEC-P8-001** (owner-only urban config) · **DEC-P8-002** (TenantAuthz extension) · **DEC-P8-003** (GET envelope vs PATCH `{ urban }`) — conflict resolver | `LOCKED_SPEC` | Manual DEC citation in PR · `p8_truth_honesty` · `p8_envelope_consistency`                                                              |
| [`appendices/CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md)       | `isWorkspaceOwner` · `canPerformUrbanOwnerMutation` · `assertWorkspaceOwner` · `URBAN_OWNER_REQUIRED` · auth matrix per route                              | `LOCKED_SPEC` | `pnpm --filter @apps/api exec node --import tsx --test test/urban-owner-ability.spec.ts` (**ABSENT_BEHAVIORAL**) · CP-8.1-05 doc review |
| [`appendices/URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md)             | HTTP + web route catalog — owner vs public · CASL subjects · rate-limit bucket keys · RULE-P8-004                                                          | `LOCKED_SPEC` | `test -f docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md` · `pnpm --filter @apps/api test urban-settings-patch.spec.ts` at 8.1            |
| [`appendices/URBAN-PRODUCT-SCOPE.md`](URBAN-PRODUCT-SCOPE.md)           | Phase 8 field delta · Prisma `Tour` + `urban_registrations` · DDL `004_urban_product_delta.sql` · outbox events                                            | `LOCKED_SPEC` | `pnpm --filter @app-tour/workspace-urban test` (golden fixtures) · migration apply at 8.2                                               |

---

## T1 — Execution maps & ERIP

| Path                                                                          | Structural purpose                                                                   | Readiness           | Verification target                                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [`appendices/SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)                   | SMK-P8-01..04 execution blocks — host, fixtures, legacy lines, observability tokens  | `VERIFIED_SCAFFOLD` | `pnpm --filter @apps/web run test:e2e:urban` · `pnpm --filter @apps/api test urban-e2e-http.spec.ts` (**ABSENT_BEHAVIORAL**) |
| [`appendices/erip/README.md`](erip/README.md)                                 | ERIP COP filename convention · YAML front-matter · guard `p8_erip_cop_present` rules | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_erip_cop_present` (exempt at 8.0)                                                             |
| [`appendices/erip/8.1-cop-auth-isolation.md`](erip/8.1-cop-auth-isolation.md) | **8.1 COP** — auth isolation · owner gate ordering · failure modes F-8.1-\*          | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_erip_cop_present` when subphase ≥ 8.1                                                         |

---

## T1 — Runtime & action maps

| Path                                                                  | Structural purpose                                                                  | Readiness           | Verification target                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| [`appendices/action-registry.md`](action-registry.md)                 | Action IDs P8-1-A01..A05 · handler → route → spec binding · API-8.1-\* row proofs   | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_doc_hardening`                            |
| [`appendices/env-runtime-matrix.md`](env-runtime-matrix.md)           | Env vars · HTTP status catalog · `ZOD_VALIDATION_FAILED` → **400** normative law    | `VERIFIED_SCAFFOLD` | REQ-P8 env rows · `p8_envelope_consistency` cross-check                  |
| [`appendices/PHASE-BOUNDARY-MATRIX.yaml`](PHASE-BOUNDARY-MATRIX.yaml) | Machine 8.1 vs 8.2 write boundaries · `allowed_write_paths` · forbidden trunk edits | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_doc_hardening` · manual path review at PR |

---

## T1 — Block F machine contracts (8.1)

| Path                                                                                                | Structural purpose                                                     | Readiness           | Verification target                                                                                 |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| [`appendices/AGENT-STATE-MAP-8.1.yaml`](AGENT-STATE-MAP-8.1.yaml)                                   | ASM-8.1-001..024 state machine · TPG bypass · spec scaffold IDs        | `VERIFIED_SCAFFOLD` | `pnpm run phase-8:guard` → `p8_hardening_artifacts` · API spec imports                              |
| [`appendices/TRACEABILITY-MATRIX-8.1.md`](TRACEABILITY-MATRIX-8.1.md)                               | REQ-P8-_ ↔ handler ↔ CP-8.1-_ ↔ smoke ↔ test path for subphase 8.1     | `VERIFIED_SCAFFOLD` | Row-level `pnpm --filter @apps/api test` commands (**ABSENT_BEHAVIORAL** on trunk)                  |
| [`appendices/urban-api-dispatch-addendum.md`](urban-api-dispatch-addendum.md)                       | Dispatch table · Zod authority links · DEC-P8-003 response split       | `LOCKED_SPEC`       | `p8_envelope_consistency` · `apps/api/test/urban-settings-patch.spec.ts`                            |
| [`appendices/URBAN-THEME-MERGE-ALGORITHM.md`](URBAN-THEME-MERGE-ALGORITHM.md)                       | Theme merge · JSONB patch · GET envelope vs PATCH bare `{ urban }`     | `LOCKED_SPEC`       | `schemas/URBAN-THEME-JSONB.schema.json` · `p8_envelope_consistency`                                 |
| [`appendices/SPEC-REGISTRY-8.1.yaml`](SPEC-REGISTRY-8.1.yaml)                                       | **6×** Phase 8.1 spec paths — single prove_with source                 | `VERIFIED_SCAFFOLD` | `p8_prove_with_parity`                                                                              |
| [`appendices/TOURS-PUBLISH-FIELD-GATE.md`](TOURS-PUBLISH-FIELD-GATE.md)                             | TPG-8.1-01..05 bypass gate · publish field allowlist                   | `LOCKED_SPEC`       | `apps/api/test/urban-tours-bypass-gate.spec.ts` (**ABSENT_BEHAVIORAL**)                             |
| [`appendices/CANLOAD-URBAN-SETTINGS.contract.ts`](CANLOAD-URBAN-SETTINGS.contract.ts)               | `canLoadUrbanSettings` TypeScript contract surface for web guard       | `VERIFIED_SCAFFOLD` | `apps/web/test/urban-owner-access.spec.ts` (**ABSENT_BEHAVIORAL** until `urban-settings-access.ts`) |
| [`appendices/schemas/URBAN-THEME-JSONB.schema.json`](schemas/URBAN-THEME-JSONB.schema.json)         | JSON Schema for `theme.urban` JSONB column shape                       | `VERIFIED_SCAFFOLD` | Schema parse in CI · merge algorithm cross-ref                                                      |
| [`appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts`](schemas/URBAN-SETTINGS-PATCH.zod.ts)             | Canonical Zod for `PATCH /urban/settings` body                         | `VERIFIED_SCAFFOLD` | Import from `apps/api/src/urban/**` at implementation                                               |
| [`appendices/schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml`](schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml) | **DEC-P8-003** authority — GET 200 `{ success, data, metadata }` shape | `LOCKED_SPEC`       | `pnpm run phase-8:guard` → `p8_envelope_consistency`                                                |

---

## T1 — Subphases (`subphases/`)

| Path                                                                          | Structural purpose                                                                               | Readiness        | Verification target                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                         | Entry gate — `phase-7:gate` · MAP §22 · `reports/phase-8-entry-verified.yaml`                    | `VERIFIED_ENTRY` | `pnpm run phase-7:gate` · `pnpm run guard:import-boundary` · entry yaml PASS                                                      |
| [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) | Single-owner CASL — SDK + API + web settings guard · **no** catalog in 8.1                       | `SPEC_ONLY`      | `pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-owner-ability.spec.ts` · `pnpm run phase-8:guard` |
| [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       | Product port — `lazy-urban-plugin.ts` · catalog/register/settings routes · plugin registry delta | `SPEC_ONLY`      | `pnpm --filter @app-tour/workspace-urban build` · urban HTTP specs per CP-8.2-\*                                                  |
| [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)                 | `TenantConnectionRouter` · silo DDL · pool vs silo rate limits                                   | `SPEC_ONLY`      | `pnpm --filter @app-tour/tenant-kernel test` (when implemented) · parallel after 8.2                                              |
| [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)         | E2E integrity — Playwright + HTTP chain · SMK-P8-01..04 · anti-hollow AH-8.4-\*                  | `SPEC_ONLY`      | `pnpm --filter @apps/web run test:e2e:urban` · [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)                                   |
| [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           | Product Parity DoD — `phase-8:gate` · forensic rubric · contract spec                            | `SPEC_ONLY`      | `pnpm run phase-8:gate` · `apps/api/test/phase-8.contract.spec.ts` (**ABSENT_BEHAVIORAL**)                                        |

---

## Guard ↔ file mapping

| Guard check ID                    | Files read / enforced                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `p8_boot_manifest`                | `BOOT-MANIFEST.yaml` · subphases `8.0`–`8.5` on disk · `package.json` `phase-8:guard`     |
| `p8_truth_honesty`                | `IMPLEMENTATION-TRUTH.md` · BL-P8-\* · `lazy-urban-plugin.ts` → 8.2 · urban shell → 7.1   |
| `p8_erip_cop_present`             | `appendices/erip/8.1-cop-auth-isolation.md` front-matter when subphase ≥ 8.1              |
| `p8_platform_core_zero_diff`      | `reports/phase-7-genericity-baseline.yaml` · `packages/platform-core` git diff            |
| `p8_agent_navigator_present`      | `AGENT-NAVIGATOR.md` · `AGENT-CURRENT-PHASE.yaml` · BOOT `boot-6b`/`boot-6c`              |
| `p8_doc_hardening`                | All **39** paths in `REQUIRED_PHASE8_PEK_FILES`                                           |
| `p8_anti_hollow`                  | PEK prose scan — forbidden hollow tokens in `docs/phase-8/`                               |
| `p8_hardening_artifacts`          | `PHASE-BOUNDARY-MATRIX.yaml` · `URBAN-SETTINGS-HTTP-ENVELOPE.yaml` · 4 API spec scaffolds |
| `p8_envelope_consistency`         | `URBAN-SETTINGS-HTTP-ENVELOPE.yaml` ↔ DEC-P8-003 docs ↔ `urban-settings-patch.spec.ts`    |
| `p8_doc_path_consistency`         | No legacy settings-owner spec basename · `BOOT-MANIFEST` prove_with · flat `urban/**`     |
| `p8_spec_path_registry`           | 6× 8.1 spec scaffolds — 4 API · SDK · web                                                 |
| `p8_casl_no_ellipsis`             | `CASL-URBAN-OWNER-SPEC.md` full `TenantAuthz` surface                                     |
| `p8_truth_attestation_sync`       | `IMPLEMENTATION-TRUTH` **25/25** attestation · no stale 9/9                               |
| `p8_owner_auth_specs`             | CASL 8.1 routes ↔ SDK/API/WEB case IDs                                                    |
| `p8_urban_routes_bound`           | Route matrix §C ⊆ dispatch addendum                                                       |
| `p8_smoke_map_present`            | SMK-P8-01..04 commands in verification-matrix                                             |
| `p8_verification_matrix_hydrated` | REQ-P8-010..012 file anchors                                                              |
| `p8_boundary_ci_hook`             | `guard:p8-boundary-diff` · PHASE-BOUNDARY-MATRIX ci_hook                                  |
| `p8_envelope_spec_depth`          | `urban-settings-patch.spec.ts` ASM-001 metadata keys per DEC-P8-003                       |
| `p8_entry_ledger_present`         | `reports/phase-8-entry-verified.yaml` scaffold · honest PENDING until phase-7:gate        |
| `p8_prove_with_parity`            | `SPEC-REGISTRY-8.1.yaml` ↔ BOOT · subphase 8.1 · truth · verification-matrix              |
| `p8_api_surface_alignment`        | **DEC-P8-004** · SDK method form · router `urban-settings-access.ts`                      |
| `p8_no_legacy_runtime_import`     | Import boundary — no `legacy/` runtime in Phase 8 paths                                   |
| `p8_urban_not_denali_rail`        | Urban workspace must not bind Denali rail                                                 |
| `p8_technical_quality`            | Doc pack TQ rubric (anti-stub prose)                                                      |

**Charter deferred checks (Sprint M):** all wired — see [`phase-8-guards.md`](../phase-8-guards.md) checks 17–21.

---

## Planned PEK extensions (not on disk — do not invent paths)

| Planned path                     | Block  | Verification target                       |
| -------------------------------- | ------ | ----------------------------------------- |
| `appendices/traceability-map.md` | future | REQ ↔ file ↔ test rollup (8.2+)           |
| `appendices/erip/8.2-cop-*.md`   | 8.2    | `p8_erip_cop_present` when subphase ≥ 8.2 |

---

## External scripts (not under `docs/phase-8/` but bound to this index)

| Path                                                    | Purpose                       | Verification target      |
| ------------------------------------------------------- | ----------------------------- | ------------------------ |
| `scripts/guards/phase-8-guard.mjs`                      | Phase 8 doc pack guard runner | `pnpm run phase-8:guard` |
| `scripts/guards/lib/phase-8-guard-lib.mjs`              | Evaluators imported by guard  | unit via guard exit 0    |
| `package.json` scripts `phase-8:guard` · `phase-8:gate` | npm entrypoints               | `pnpm run phase-8:guard` |

---

## Read order (machine)

```text
1. phase-8-agent-router.md
2. audits/IMPLEMENTATION-TRUTH.md
3. AGENT-NAVIGATOR.md + appendices/AGENT-CURRENT-PHASE.yaml
4. appendices/BOOT-MANIFEST.yaml → detect_current_subphase
5. subphases/{current}.md
6. appendices/PRECISION-DOC-INDEX.md (this file) — locate tier-1 maps + Block F contracts
6. Tier-0 locked specs for active subphase (CASL / ROUTE / PRODUCT / DEC-P8-003 envelope)
7. appendices/AGENT-STATE-MAP-8.1.yaml + TRACEABILITY-MATRIX-8.1.md — when subphase = 8.1
8. appendices/SMOKE-SCENARIO-MAP.md — when subphase ≥ 8.4
```

---

## Cross-phase references (read-only, not indexed as Phase 8 PEK)

| Path                                                | Role                                      |
| --------------------------------------------------- | ----------------------------------------- |
| `docs/phase-7/audits/IMPLEMENTATION-TRUTH.md`       | Phase 7 honesty — 8.0 prerequisite        |
| `docs/phase-7/appendices/URBAN-MINIMAL-SCOPE.md`    | Phase 7 field baseline for 8.2            |
| `docs/phase-7/appendices/LEGACY-URBAN-REFERENCE.md` | Legacy read-only pointers                 |
| `docs/appendices/PLATFORM-CONTINUITY-0-7.md`        | Platform continuity through Phase 7       |
| `reports/phase-7-genericity-baseline.yaml`          | `p8_platform_core_zero_diff` baseline SHA |
