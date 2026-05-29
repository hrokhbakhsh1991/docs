# Denali structural guards

Config- and domain-level checks that must stay aligned as the registry, focus map, and draft pipeline evolve. They do **not** mount the wizard UI.

## Naming

| Pattern | Meaning |
|---------|---------|
| `denali-<topic>.guard.test.ts` | Structural guard (Vitest) |
| `denali-<topic>.perf.spec.tsx` | jsdom performance ceiling (Jest only) |

All suites use `describe…(structural guard)` or `describe…(perf guard)` via `describeConfigStructuralGuard` / `describeStructuralGuard` in `wizard/testing/structural-guard.ts`.

## File index

| File | Type | Validates |
|------|------|-----------|
| `denali-focus-coverage.guard.test.ts` | Config | Registry ↔ `denaliWizardFieldFocus` |
| `denali-readiness-path-coverage.guard.test.ts` | Config | Publish-readiness path fixtures |
| `denali-draft-registry-coverage.guard.test.ts` | Config | Draft sanitize round-trip |
| `denali-error-handling-integrity.guard.test.ts` | Config | Blocking codes ↔ registry/focus paths |
| `denali-template-canonical-registry.guard.test.ts` | Domain | Template keys ↔ registry |
| `denali-section-suppress.guard.test.ts` | Domain | Flat-edit suppress paths |
| `denali-wizard-header-plugins.guard.test.ts` | Filesystem | Create vs edit header plugins |
| `denali-section-mount.perf.spec.tsx` | Perf | `DenaliSection` mount latency |

## Adding a guard

1. Extend `wizardTestConfig.denali.ts` if the check is workspace-config driven.
2. Add a `verify*` function in `wizard-testing-utils.ts` when the assertion is reusable across workspaces.
3. Create `denali-<topic>.guard.test.ts`:

```ts
import { describeConfigStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";
import { verifyMyInvariant } from "@/features/tours/wizard/testing/wizard-testing-utils";
import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

describeConfigStructuralGuard("denali my topic", denaliTestConfig, [
  { name: "…", verify: verifyMyInvariant },
]);
```

4. Run: `pnpm --filter @apps/web exec vitest run src/features/tours/wizard/denali/__tests__/guards`
