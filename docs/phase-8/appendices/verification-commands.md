# Phase 8 — Verification commands

```yaml
binding: REPO_SCRIPTS_OVER_STALE_MD
atlas: ../audits/verification-matrix.md
navigator: ../AGENT-NAVIGATOR.md
```

> **Agents:** Run from repository root after `nvm use && corepack enable`. Full CMD blocks: [`verification-matrix.md`](../audits/verification-matrix.md) § Command blocks.

---

## 8.0 Entry

```bash
pnpm run phase-7:gate
pnpm run guard:import-boundary
if rg "from ['\"]legacy/" apps/api apps/web; then exit 1; else exit 0; fi
rg 'map_22_reviewed:\s*true' reports/phase-8-entry-verified.yaml
test -f reports/phase-8-genericity-baseline.yaml || test -f reports/phase-7-genericity-baseline.yaml
pnpm run phase-8:guard
```

---

## 8.1 Single-Owner auth

```bash
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-redis-fallback.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-tours-bypass-gate.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/urban-owner-access.spec.ts
pnpm run guard:import-boundary
pnpm run guard:p8-boundary-diff
```

---

## 8.2 Urban product port

```bash
pnpm --filter @app-tour/workspace-urban build
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/urban-registry.spec.ts
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/**/*.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-catalog-registration.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts
if rg 'urban.*denali|denali.*urban' packages/workspace-sdk/src/plugin/workspace-type-binding.ts; then exit 1; else exit 0; fi
pnpm run guard:import-boundary
BASELINE_SHA="$(grep baseline_sha reports/phase-8-genericity-baseline.yaml | awk '{print $2}')"
git diff "${BASELINE_SHA}" -- packages/platform-core | test ! -s
```

---

## 8.3 Silo tier

```bash
test -f infra/sql/005_tenant_routes.sql
pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test test/tenant-connection-router.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-silo-fixture.spec.ts
```

---

## 8.4 E2E integrity

```bash
pnpm --filter @apps/web run test:e2e:urban
pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts
pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-04'
```

---

## 8.5 Product Parity DoD

```bash
pnpm run phase-8:gate
pnpm --filter @apps/api exec node --import tsx --test test/phase-8.contract.spec.ts
pnpm run ci:integrity
test -f docs/audits/phase-8-zero-debt-forensic-audit.mdoc
rg -q 'verdict:\s*PASS' docs/audits/phase-8-zero-debt-forensic-audit.mdoc
```
