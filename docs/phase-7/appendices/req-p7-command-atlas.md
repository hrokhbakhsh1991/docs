# Phase 7 — REQ-P7 command atlas

```yaml
node: ">=24.0.0 <25"
prerequisite: pnpm run phase-6:gate
binding: REPO_SCRIPTS_OVER_STALE_MD
```

## Full gate (closure — includes code when implemented)

```bash
nvm use && corepack enable && pnpm install
pnpm run phase-7:gate
# = build + test + phase-6:guard + phase-7:guard (denested; does not nest phase-6:gate)
```

## Doc-only validation

```bash
pnpm run phase-7:guard
node scripts/guards/lib/phase-7-doc-hardening.mjs
node scripts/guards/lib/anti-hollow-phase7.mjs
# reports/phase-7-gate-YYYY-MM-DD.json
```

## Per subphase

| Subphase | Commands                                                                                                            | Pass signal         |
| -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **7.0**  | `pnpm run phase-6:gate` · update `reports/phase-7-entry-verified.yaml`                                              | yaml PASS           |
| **7.1**  | `pnpm --filter @app-tour/workspace-urban build` · `pnpm --filter @app-tour/workspace-urban test`                    | build 0             |
| **7.2**  | `pnpm --filter @app-tour/workspace-urban test phase-7.contract.spec.ts` · `git diff main -- packages/platform-core` | empty diff          |
| **7.3**  | `pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts`                         | urban resolve green |
| **7.4**  | `pnpm --filter @apps/api exec node --import tsx --test test/urban-create-publish.integration.spec.ts`               | create→publish      |
| **7.5**  | `node scripts/guards/audit-log-fields.mjs` (create in 7.5) · runbook review                                         | §10.2 fields        |
| **7.6**  | `pnpm --filter @apps/api exec node --import tsx --test test/rate-limit-tenant.spec.ts`                              | 429 per tenant      |
| **7.7**  | `pnpm --filter @app-tour/tenant-kernel test tenant-connection-router.spec.ts`                                       | pool + silo         |
| **7.8**  | `pnpm run ci:integrity`                                                                                             | exit 0              |
| **7.9**  | `pnpm run phase-7:gate` · forensic mdoc                                                                             | purity ≥ 8          |

## p7\_\* guard map (doc)

| id                         | Verify                         |
| -------------------------- | ------------------------------ |
| `p7_boot_manifest`         | BOOT-MANIFEST.yaml             |
| `p7_doc_hardening`         | PEK file set + TG-P7-005       |
| `p7_urban_absence_honesty` | package absent until 7.1 lands |
| `p7_truth_honesty`         | IMPLEMENTATION-TRUTH           |

See [`phase-7-guards.md`](phase-7-guards.md).
