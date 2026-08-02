# Phase 8 — Guards reference

```yaml
guard_version: "2026-08-02-v3"
authority: MAP §12 R2 · phase-8-agent-router.md · phase-8-charter.md
fail_token: FAIL
charter_gates: 25
runner: scripts/guards/phase-8-guard.mjs
```

## Commands

| Script                                                    | Role                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm run phase-8:guard`                                  | Phase 8 charter gates (25 checks · doc + invariants + hardening + Sprint A navigator + F–M)   |
| `pnpm run guard:p8-boundary-diff`                         | 8.1 PR boundary diff vs [`PHASE-BOUNDARY-MATRIX.yaml`](appendices/PHASE-BOUNDARY-MATRIX.yaml) |
| `pnpm run phase-8:gate`                                   | `build` + `test` + `phase-7:guard` + `phase-8:guard` (denested; no `phase-7:gate`) |
| `node scripts/guards/phase-8-guard.mjs`                   | Direct guard invocation (same as `phase-8:guard`)                                             |
| `node scripts/guards/lib/phase-8-guard-lib.mjs`           | Shared evaluators (`evaluateP8*`)                                                             |
| `node scripts/guards/lib/phase-8-doc-hardening.mjs`       | PEK file presence (`verifyDocHardening`)                                                      |
| `node scripts/guards/lib/anti-hollow-phase8.mjs`          | Hollow prose scanner (`verifyAntiHollow`)                                                     |
| `node scripts/guards/lib/phase-8-hardening-artifacts.mjs` | Hardening YAML + API spec scaffolds (`verifyHardeningArtifacts`)                              |

**Fast-track (daily iteration):** prefer `pnpm run phase-8:guard` alone — **do not** run `phase-8:gate` without explicit Architect approval (~30 min nested chain).

**Execution law:** checks run **in order** · **fail-fast** on first breach · **no** report JSON written on failure.

---

## `phase-8:guard` check matrix

| #   | Check ID                          | Required | Evaluator                                                           | Pass criteria                                                                                                                                                                                                 |
| --- | --------------------------------- | -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `p8_boot_manifest`                | yes      | `evaluateP8BootManifest` (`phase-8-guard-lib.mjs`)                  | `docs/phase-8/appendices/BOOT-MANIFEST.yaml` exists · structural YAML valid · subphases `8.0`–`8.5` · `gate_chain` declares `phase-8:guard`                                                                   |
| 2   | `p8_truth_honesty`                | yes      | `evaluateP8TruthHonesty`                                            | `IMPLEMENTATION-TRUTH.md` consistent · **no BL-P8-03** · `lazy-urban-plugin.ts` → subphase **8.2** · urban package shell → **7.1** · all subphase specs on disk                                               |
| 3   | `p8_erip_cop_present`             | yes      | `evaluateP8EripCopPresent`                                          | When **doc_ready_subphase ≥ 8.1** or behavioral **8.1–8.3**: COP in `appendices/erip/` with front-matter · **exempt at behavioral 8.0 with doc_ready < 8.1**                                                  |
| 4   | `p8_platform_core_zero_diff`      | yes      | `evaluateP8PlatformCoreZeroDiff`                                    | When `baseline_sha` resolves in git: empty `git diff <sha> -- packages/platform-core` · working tree clean (INV-P8-001). When the SHA is missing from the clone (shallow CI / digest-lock tokens such as `deadbeef*`): compare live `packages/platform-core` tree digest to `platform_core_tree_digest` in the same baseline YAML (Phase 7 REQ-P7-007 algorithm: sha256 over sorted `relPath\\tfileSha256` lines, skipping `node_modules`/`dist`/`coverage` and `*.md`) · working tree still clean                                                                                                                                          |
| 5   | `p8_doc_hardening`                | yes      | `verifyDocHardening` (`phase-8-doc-hardening.mjs`)                  | All **39** canonical PEK paths under `docs/phase-8/` exist on disk                                                                                                                                            |
| 6   | `p8_anti_hollow`                  | yes      | `verifyAntiHollow` (`anti-hollow-phase8.mjs`)                       | No `TODO` / `FIXME` / `TBD` / `placeholder` / `insert here` / empty table rows in `docs/phase-8/**` (`.md`, `.yaml`)                                                                                          |
| 7   | `p8_hardening_artifacts`          | yes      | `verifyHardeningArtifacts` (`phase-8-hardening-artifacts.mjs`)      | `URBAN-SETTINGS-HTTP-ENVELOPE.yaml` · `PHASE-BOUNDARY-MATRIX.yaml` on disk with `contract_id` · no `{...}` ellipses · 4× `apps/api/test/urban-*.spec.ts` scaffolds with `describe` / `it` / `expect().toBe()` |
| 8   | `p8_envelope_consistency`         | yes      | `verifyEnvelopeConsistency` (`phase-8-hardening-artifacts.mjs`)     | **DEC-P8-003** · GET cites `URBAN-SETTINGS-HTTP-ENVELOPE.yaml` · no bare `{ urban }` on GET in merge algorithm · CASL `handleGetUrbanSettings` present                                                        |
| 9   | `p8_doc_path_consistency`         | yes      | `verifyDocPathConsistency` (`phase-8-hardening-artifacts.mjs`)      | No legacy **settings-owner** spec basename in `docs/phase-8/**` · `BOOT-MANIFEST.yaml` prove_with cites `urban-settings-patch.spec.ts` · flat `apps/api/src/urban/**` in boundary matrix                      |
| 10  | `p8_spec_path_registry`           | yes      | `verifySpecPathRegistry` (`phase-8-hardening-artifacts.mjs`)        | **6** paths: 4× `apps/api/test/urban-*.spec.ts` · `packages/workspaces/urban/test/urban-owner-ability.spec.ts` · `apps/web/test/urban-owner-access.spec.ts` — each with `describe` / `it` / SDK-8.1 case IDs |
| 11  | `p8_casl_no_ellipsis`             | yes      | `verifyCaslNoEllipsis` (`phase-8-hardening-artifacts.mjs`)          | `CASL-URBAN-OWNER-SPEC.md` lists full `TenantAuthz` method surface · no `// … existing methods …` ellipsis                                                                                                    |
| 12  | `p8_truth_attestation_sync`       | yes      | `verifyTruthAttestationSync` (`phase-8-hardening-artifacts.mjs`)    | No stale **9/9** attestation · `IMPLEMENTATION-TRUTH` cites `25/25 PASS` and `charter_gates: 25`                                                                                                              |
| 13  | `p8_agent_navigator_present`      | yes      | `verifyAgentNavigatorPresent` (`phase-8-hardening-artifacts.mjs`)   | `AGENT-NAVIGATOR.md` decision tree · `AGENT-CURRENT-PHASE.yaml` · BOOT `boot-6b`/`boot-6c`                                                                                                                    |
| 14  | `p8_prove_with_parity`            | yes      | `verifyProveWithParity` (`phase-8-hardening-artifacts.mjs`)         | `SPEC-REGISTRY-8.1.yaml` ↔ guard registry ↔ BOOT-MANIFEST 8.1 ↔ subphase 8.1 ↔ truth ↔ verification-matrix                                                                                                    |
| 15  | `p8_api_surface_alignment`        | yes      | `verifyApiSurfaceAlignment` (`phase-8-hardening-artifacts.mjs`)     | Phase 10.5 · urban package `canPerformUrbanOwnerMutation` helper · `isWorkspaceOwner` from `@app-tour/workspace-sdk/auth` · router urban-settings-access                                                      |
| 16  | `p8_envelope_spec_depth`          | yes      | `verifyEnvelopeSpecDepth` (`phase-8-hardening-artifacts.mjs`)       | `urban-settings-patch.spec.ts` ASM-001 asserts `metadata.correlationId` · `primaryColor` · `featureFlags` · `rateLimitRps`                                                                                    |
| 17  | `p8_entry_ledger_present`         | yes      | `verifyEntryLedgerPresent` (`phase-8-hardening-artifacts.mjs`)      | `reports/phase-8-entry-verified.yaml` exists · `phase_7_gate` · `map_22_reviewed` · `status: PENDING\|PASS` · PASS requires `exit_code: 0`                                                                    |
| 18  | `p8_owner_auth_specs`             | yes      | `verifyOwnerAuthSpecs` (`phase-8-charter-deferred.mjs`)             | CASL 8.1 `GET/PATCH /urban/settings` rows ↔ SDK/API/WEB case IDs on disk                                                                                                                                      |
| 19  | `p8_urban_routes_bound`           | yes      | `verifyUrbanRoutesBound` (`phase-8-charter-deferred.mjs`)           | Route matrix §C settings paths ⊆ dispatch addendum · 8.2 paths in `out_of_scope_8_1` only                                                                                                                     |
| 20  | `p8_smoke_map_present`            | yes      | `verifySmokeMapPresent` (`phase-8-charter-deferred.mjs`)            | SMK-P8-01..04 each has executable command in verification-matrix smoke index                                                                                                                                  |
| 21  | `p8_verification_matrix_hydrated` | yes      | `verifyVerificationMatrixHydrated` (`phase-8-charter-deferred.mjs`) | REQ-P8-010..012 cite spec anchors + on-disk test paths                                                                                                                                                        |
| 22  | `p8_boundary_ci_hook`             | yes      | `verifyBoundaryCiHook` (`phase-8-charter-deferred.mjs`)             | `p8-boundary-diff.mjs` on disk · documented in guards + PHASE-BOUNDARY-MATRIX                                                                                                                                 |
| 23  | `p8_no_legacy_runtime_import`     | yes      | `runP8NoLegacyRuntimeImport` (`phase-8-guard.mjs`)                  | Zero legacy imports in urban scan roots                                                                                                                                                                       |
| 24  | `p8_urban_not_denali_rail`        | yes      | `runP8UrbanNotDenaliRail` (`phase-8-guard.mjs`)                     | Urban ↔ denali isolation · skip `workspace-plugin-loaders.generated.ts` (Phase 10 multi-plugin loader)                                                                                                          |
| 25  | `p8_technical_quality`            | yes      | `runP8TechnicalQuality` (`phase-8-guard.mjs`)                       | TQ-P8-001..010 in charter                                                                                                                                                                                     |

---

## Fail tokens

On breach `phase-8-guard.mjs` prints **one** token to **stderr** and exits **1** immediately.

### Primary runner token

```text
FAIL P8-GUARD-<check_id>: <detail>
```

| `check_id`                                        | Typical source                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `p8_boot_manifest` … `p8_platform_core_zero_diff` | `failToken()` in `phase-8-guard-lib.mjs`                                             |
| `p8_doc_hardening`                                | `verifyDocHardening` — normalized to `p8_doc_hardening`                              |
| `p8_anti_hollow`                                  | `verifyAntiHollow` — normalized to `p8_anti_hollow`                                  |
| `p8_hardening_artifacts`                          | `verifyHardeningArtifacts` — normalized to `p8_hardening_artifacts`                  |
| `p8_envelope_consistency`                         | `verifyEnvelopeConsistency` — normalized to `p8_envelope_consistency`                |
| `p8_doc_path_consistency`                         | `verifyDocPathConsistency` — normalized to `p8_doc_path_consistency`                 |
| `p8_spec_path_registry`                           | `verifySpecPathRegistry` — normalized to `p8_spec_path_registry`                     |
| `p8_casl_no_ellipsis`                             | `verifyCaslNoEllipsis` — normalized to `p8_casl_no_ellipsis`                         |
| `p8_truth_attestation_sync`                       | `verifyTruthAttestationSync` — normalized to `p8_truth_attestation_sync`             |
| `p8_prove_with_parity`                            | `verifyProveWithParity` — normalized to `p8_prove_with_parity`                       |
| `p8_api_surface_alignment`                        | `verifyApiSurfaceAlignment` — normalized to `p8_api_surface_alignment`               |
| `p8_envelope_spec_depth`                          | `verifyEnvelopeSpecDepth` — normalized to `p8_envelope_spec_depth`                   |
| `p8_entry_ledger_present`                         | `verifyEntryLedgerPresent` — normalized to `p8_entry_ledger_present`                 |
| `p8_owner_auth_specs`                             | `verifyOwnerAuthSpecs` — normalized to `p8_owner_auth_specs`                         |
| `p8_urban_routes_bound`                           | `verifyUrbanRoutesBound` — normalized to `p8_urban_routes_bound`                     |
| `p8_smoke_map_present`                            | `verifySmokeMapPresent` — normalized to `p8_smoke_map_present`                       |
| `p8_verification_matrix_hydrated`                 | `verifyVerificationMatrixHydrated` — normalized to `p8_verification_matrix_hydrated` |
| `p8_boundary_ci_hook`                             | `verifyBoundaryCiHook` — normalized to `p8_boundary_ci_hook`                         |
| `p8_no_legacy_runtime_import`                     | Inline scan in `phase-8-guard.mjs`                                                   |
| `p8_urban_not_denali_rail`                        | Inline scan in `phase-8-guard.mjs`                                                   |
| `p8_technical_quality`                            | Charter TQ attestation in `phase-8-guard.mjs`                                        |

### Submodule throw tokens (caught and re-mapped)

Sub-modules emit typed prefixes before the runner normalizes them:

```text
FAIL P8-GUARD-HARDENING: Missing required PEK file at <path>
FAIL P8-GUARD-HOLLOW: Hollow text or placeholder discovered in file <file> at line <line_content>
FAIL P8-GUARD-HARDENING-ARTIFACTS: <missing path or formatting violation>
```

The runner surfaces these as `FAIL P8-GUARD-p8_doc_hardening: …`, `FAIL P8-GUARD-p8_anti_hollow: …`, and `FAIL P8-GUARD-p8_hardening_artifacts: …` respectively.

Halt implementation · cite rule · request Architect approval per router §1.

---

## `phase-8:gate` expansion

```bash
pnpm build \
  && pnpm test \
  && pnpm run phase-7:gate \
  && pnpm run phase-8:guard
```

| Stage           | Blocks                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| `pnpm build`    | Compile regressions across workspace packages                               |
| `pnpm test`     | Unit/integration baseline                                                   |
| `phase-7:gate`  | Nested Phase 6 + Phase 7 doc/urban honesty                                  |
| `phase-8:guard` | All **24** charter gates (Sprint F–M · registry · smoke · boundary CI hook) |

**8.5 behavioral proofs** (`phase-8.contract.spec.ts`, E2E, forensic) are **not** included in `phase-8:guard` — they run inside the full gate chain at Product Parity closure.

---

## Husky pre-commit (`pre-commit:fast`)

| Path touched                   | Guard behavior                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `docs/phase-8/**`              | `guard-docs.sh` requires matching doc updates for protected packages                          |
| `packages/platform-core/**`    | Blocked without `docs/` change · `p8_platform_core_zero_diff` must pass in Phase 8 PR CI      |
| `packages/workspaces/urban/**` | `guard:import-boundary` + `test:changed` · ERIP COP required before merge when subphase ≥ 8.1 |

**Pre-commit does not run `phase-8:gate` by default** — target &lt;60s per `.cursorrules`. Phase 8 guard may be invoked in CI for `docs/phase-8` or `packages/workspaces/urban` path filters.

---

## CI pipeline integration (wired)

Workflow: [`.github/workflows/phase-8-gate.yml`](../../.github/workflows/phase-8-gate.yml)

| Job | Trigger | Purpose |
| --- | ------- | ------- |
| `guard` | PR + `phase-8/**` push (path filter) | `phase-8:guard` · `guard:p8-boundary-diff` · `guard:import-boundary` |
| `urban-regression` | After guard | Contract + 8.1–8.4 proof bundle (memory) |
| `urban-e2e` | After guard | Playwright SMK-P8-01..04 |
| `ci-integrity` | `main` push or manual | Cross-phase 0→3 integrity |
| `phase-8-gate-full` | `main` push or manual `run_full_phase_8_gate` | Full `pnpm run phase-8:gate` with Postgres + Redis |

Manual full gate: **Actions → phase-8-gate → Run workflow** → enable `run_full_phase_8_gate`.

| PR type                      | Minimum guard                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doc-only Phase 8 PEK         | `pnpm run phase-8:guard`                                                                                                                                                                 |
| Urban product code (8.1–8.2) | `phase-8:guard` + `guard:import-boundary` + `guard:p8-boundary-diff` (8.1 PR train) + subphase `prove_with` bundle from [`audits/verification-matrix.md`](audits/verification-matrix.md) |
| Phase 8 closure (8.5)        | `pnpm run phase-8:gate` + `ci:integrity`                                                                                                                                                 |

---

## ERIP COP archive

| Path                                                        | Format                          |
| ----------------------------------------------------------- | ------------------------------- |
| `docs/phase-8/appendices/erip/<subphase>-cop-YYYY-MM-DD.md` | Markdown with YAML front-matter |

Required front-matter keys (parsed by `p8_erip_cop_present`):

```yaml
---
subphase: "8.1"
approval_date: "2026-06-07"
vetted_2026_enterprise_source_urls:
  - https://casl.js.org/
  - https://nextjs.org/docs
---
```

See router §5 ERIP for full Creativity & Optimization Proposal body.

---

## Behavioral guards (implementation subphases)

| Guard / spec                         | Subphase | Target                                                   |
| ------------------------------------ | -------- | -------------------------------------------------------- |
| `urban-owner-ability.spec.ts`        | 8.1      | SDK CASL owner contract (`packages/workspace-sdk/test/`) |
| `urban-settings-patch.spec.ts`       | 8.1      | API GET/PATCH + 403 matrix (`apps/api/test/`)            |
| `urban-owner-access.spec.ts`         | 8.1      | Web guard (`apps/web/test/`)                             |
| `urban-catalog-registration.spec.ts` | 8.2      | Public catalog + registration HTTP                       |
| `tenant-connection-router.spec.ts`   | 8.3      | Silo router                                              |
| `test:e2e:urban`                     | 8.4      | SMK-P8-01..04                                            |
| `phase-8.contract.spec.ts`           | 8.5      | Product Parity without platform-core diff                |

Command atlas: [`audits/verification-matrix.md`](audits/verification-matrix.md).

---

## Report output

On **zero-breach** success only, the runner writes:

```text
reports/phase-8-gate-2026-06-07.json
```

(Date suffix defaults to UTC `YYYY-MM-DD`; override with `PHASE_8_GATE_REPORT`.)

Verified baseline artifact (Sprint A): [`reports/phase-8-gate-2026-06-08.json`](../../reports/phase-8-gate-2026-06-08.json) — `ok: true` · `charter_gates: 25` · all checks `PASS`.

Shape:

```json
{
  "gate": "phase-8",
  "date": "2026-06-08",
  "ok": true,
  "fail_token": null,
  "charter_gates": 24,
  "active_subphase": "8.0",
  "platform_core_baseline_sha": "64d9fea",
  "checks": [
    { "id": "p8_boot_manifest", "required": true, "ok": true },
    { "id": "p8_truth_honesty", "required": true, "ok": true },
    { "id": "p8_erip_cop_present", "required": true, "ok": true },
    { "id": "p8_platform_core_zero_diff", "required": true, "ok": true },
    { "id": "p8_doc_hardening", "required": true, "ok": true },
    { "id": "p8_anti_hollow", "required": true, "ok": true },
    { "id": "p8_hardening_artifacts", "required": true, "ok": true },
    { "id": "p8_envelope_consistency", "required": true, "ok": true },
    { "id": "p8_doc_path_consistency", "required": true, "ok": true },
    { "id": "p8_spec_path_registry", "required": true, "ok": true },
    { "id": "p8_casl_no_ellipsis", "required": true, "ok": true },
    { "id": "p8_truth_attestation_sync", "required": true, "ok": true },
    { "id": "p8_prove_with_parity", "required": true, "ok": true },
    { "id": "p8_api_surface_alignment", "required": true, "ok": true },
    { "id": "p8_envelope_spec_depth", "required": true, "ok": true },
    { "id": "p8_entry_ledger_present", "required": true, "ok": true },
    { "id": "p8_owner_auth_specs", "required": true, "ok": true },
    { "id": "p8_urban_routes_bound", "required": true, "ok": true },
    { "id": "p8_smoke_map_present", "required": true, "ok": true },
    { "id": "p8_verification_matrix_hydrated", "required": true, "ok": true },
    { "id": "p8_boundary_ci_hook", "required": true, "ok": true },
    { "id": "p8_no_legacy_runtime_import", "required": true, "ok": true },
    { "id": "p8_urban_not_denali_rail", "required": true, "ok": true },
    { "id": "p8_technical_quality", "required": true, "ok": true }
  ]
}
```

---

## Environment variables

| Variable              | Effect                                     |
| --------------------- | ------------------------------------------ |
| `PHASE_8_GATE_REPORT` | Override report date suffix (`YYYY-MM-DD`) |

---

## Related documents

| Doc                                                                      | Role                           |
| ------------------------------------------------------------------------ | ------------------------------ |
| [`phase-8-agent-router.md`](phase-8-agent-router.md)                     | SOLE entry · ERIP · FAIL token |
| [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml)         | Subphase DAG                   |
| [`appendices/PRECISION-DOC-INDEX.md`](appendices/PRECISION-DOC-INDEX.md) | PEK file index (**33** paths)  |
| [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)       | Honesty ledger                 |
| [`audits/verification-matrix.md`](audits/verification-matrix.md)         | REQ-P8 commands                |
