# Phase 6 — REQ-P6 command atlas

```yaml
node: ">=24.0.0 <25"
prerequisite: pnpm run phase-5:gate
binding: REPO_SCRIPTS_OVER_STALE_MD
```

## Full gate (closure — includes code when implemented)

```bash
nvm use && corepack enable && pnpm install
pnpm run phase-6:gate
# = phase-5:gate + phase-6:guard + build/test targets (package.json)
```

## Doc-only validation

```bash
pnpm run phase-6:guard
node scripts/guards/lib/anti-hollow-phase6.mjs
# reports/phase-6-gate-YYYY-MM-DD.json
```

## Per subphase

| Subphase | Commands                                                                                           | Pass signal        |
| -------- | -------------------------------------------------------------------------------------------------- | ------------------ |
| **6.0**  | `pnpm run phase-5:gate` · update `reports/phase-6-entry-verified.yaml`                             | yaml PASS          |
| **6.1**  | `pnpm --filter @app-tour/workspace-denali build` · `pnpm --filter @app-tour/workspace-denali test` | build 0            |
| **6.2**  | `pnpm --filter @app-tour/workspace-denali run denali:codegen` · registry-parity test               | diff clean         |
| **6.3**  | workspace-denali test · theme guard                                                                | composites resolve |
| **6.4**  | `finance-outbox-consumer.spec.ts`                                                                  | stub or 5.4 green  |
| **6.5**  | `pnpm --filter @apps/api test` denali-workspace-plugin                                             | resolve denali     |
| **6.6**  | smoke / Playwright                                                                                 | golden fixtures    |
| **6.7**  | minio-photo spec (MINIO\_\* set)                                                                   | tenant prefix      |
| **6.8**  | migrate-canonical-denali spec                                                                      | single SoT         |
| **6.9**  | `pnpm run phase-6:gate` · forensic report                                                          | purity ≥ 8         |

## p6\_\* guard map (doc)

| id                        | Verify                 |
| ------------------------- | ---------------------- |
| `p6_boot_manifest`        | BOOT-MANIFEST.yaml     |
| `p6_doc_hardening`        | PEK file set           |
| `p6_denali_probe_honesty` | README until 6.1 lands |

See [`phase-6-guards.md`](../phase-6-guards.md).
