# Phase 9 — Guards reference

```yaml
guard_version: "2026-06-08-v6"
authority: MAP §12 R2 · phase-9-agent-router.md
fail_token: FAIL
charter_gates: 32
runner: scripts/guards/phase-9-guard.mjs
```

## Commands

| Script                            | Role                                        |
| --------------------------------- | ------------------------------------------- |
| `pnpm run phase-9:guard`          | 32 charter gates — doc pack attestation     |
| `pnpm run guard:p9-boundary-diff` | 9.1 PR boundary allowlist                   |
| `pnpm run phase-9:gate`           | build + test + phase-8:gate + phase-9:guard |

## Hook suspension (velocity — active)

While [`appendices/PHASE-9-HOOKS-SUSPENSION.yaml`](appendices/PHASE-9-HOOKS-SUSPENSION.yaml) has `active: true`:

| Enforcement | Status |
| ----------- | ------ |
| Husky `pre-commit:fast` | **Suspended** — instant commits |
| `phase-9:guard` / `phase-9:gate` | **Manual** — run at subphase stabilization or 9.8 |
| `test-changed` / `test:full` | **Manual** |
| GHA on push | **Unchanged** — defer push or draft PR if needed |

Re-enable: delete marker at **9.8** · see `re_enable.verify` in yaml · `bash scripts/phase-hooks-suspended.sh` (exit 1 = hooks active).

---

## Full check matrix (32 gates)

| #   | Check ID                      | Pass criteria                                                       |
| --- | ----------------------------- | ------------------------------------------------------------------- |
| 1   | `p9_boot_manifest`            | BOOT-MANIFEST · subphases · `charter_gates: 32` · dependency_graph  |
| 2   | `p9_truth_honesty`            | IMPLEMENTATION-TRUTH · **32/32** attestation sync                   |
| 3   | `p9_doc_hardening`            | 58+ PEK paths on disk                                               |
| 4   | `p9_anti_hollow`              | PEK prose scan — no hollow tokens per guard lib                     |
| 5   | `p9_hardening_artifacts`      | Block F artifacts + identity OTP schemas                            |
| 6   | `p9_spec_path_registry`       | 9.1 spec scaffolds describe/it/assert                               |
| 7   | `p9_prove_with_parity`        | SPEC-REGISTRY-9.1 ↔ BOOT 9.1 prove_with                             |
| 8   | `p9_traceability_9_1`         | TRACEABILITY-MATRIX-9.1 depth tokens                                |
| 9   | `p9_operator_spec_depth`      | CASL-OPERATOR-SPEC full surface                                     |
| 10  | `p9_forbidden_catalog`        | P9-F-001..009                                                       |
| 11  | `p9_product_scope_out`        | `permanent_out_of_scope` + `full_app_parity_inventory` (DEC-P9-008) |
| 12  | `p9_traceability_map`         | TRACEABILITY-MAP · REQ-P9-083 · closure bundle                      |
| 13  | `p9_boundary_matrix_depth`    | PHASE-BOUNDARY-MATRIX 9.2–9.7 paths                                 |
| 14  | `p9_entry_ledger_present`     | phase-9-entry-verified.yaml                                         |
| 15  | `p9_verification_matrix`      | ≥15 REQ-P9 + P9-F-001                                               |
| 16  | `p9_admin_route_matrix`       | ADMIN-ROUTE-MATRIX + DEC-P9-007                                     |
| 17  | `p9_decisions_locked`         | DEC-P9-001..007                                                     |
| 18  | `p9_subphase_specs`           | 9.0–9.8 on disk                                                     |
| 19  | `p9_smoke_map_present`        | SMK-P9-01..08                                                       |
| 20  | `p9_erip_cop_depth`           | 8 COPs · cop_id + F-9.\* failure modes                              |
| 21  | `p9_forensic_rubric`          | FORENSIC-RUBRIC-P9 ↔ mdoc                                           |
| 22  | `p9_smoke_fixture_sot`        | operator-smoke-e2e-tenant.ts                                        |
| 23  | `p9_e2e_wiring`               | playwright.operator.config.ts + test:e2e:operator                   |
| 24  | `p9_adversarial_matrix`       | ADVERSARIAL-MATRIX-P9 ADV-P9-01..10                                 |
| 25  | `p9_platform_core_zero_diff`  | platform-core git diff empty                                        |
| 26  | `p9_no_legacy_runtime_import` | no legacy imports in apps                                           |
| 27  | `p9_phase9_gate_script`       | phase-9:gate chains phase-8:gate                                    |
| 28  | `p9_technical_quality`        | TQ-P9-001..010 in charter                                           |
| 29  | `p9_navigator_present`        | AGENT-NAVIGATOR.md · ≥8 decision nodes                              |
| 30  | `p9_leader_actor_drift`       | no Leader RBAC actor in route matrix / router                       |
| 31  | `p9_finance_path_dual`        | interim + target finance paths (DEC-P9-017)                         |
| 32  | `p9_current_phase_snapshot`   | AGENT-CURRENT-PHASE.yaml ↔ truth · TEMP scaffold manifest           |

---

## Report

`reports/phase-9-gate-YYYY-MM-DD.json` → `{ ok: true, charter_gates: 32, passed: 32 }` when doc pack + T-9.1 scaffolds on trunk.
