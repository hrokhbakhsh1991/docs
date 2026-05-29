/**
 * Shared runner for workspace wizard structural guards (node:test / Vitest).
 *
 * Auth/session fixtures live in `@/lib/test/session-fixtures` — not here.
 * Registry/focus/publish-readiness checks use {@link WizardTestConfig} from `wizard-testing-utils`.
 */
import { describe, it } from "vitest";

import type { WizardTestConfig } from "./wizard-testing-utils";

export type StructuralGuardCheck<StepId extends string = string, Form = unknown> = {
  name: string;
  verify: (config: WizardTestConfig<StepId, Form>) => void;
};

export type StructuralGuardRun = {
  name: string;
  run: () => void;
};

/** Config-driven guards: pass `denaliTestConfig` (or another workspace config) + `verify*` fns. */
export function describeConfigStructuralGuard<StepId extends string, Form>(
  suiteLabel: string,
  config: WizardTestConfig<StepId, Form>,
  checks: readonly StructuralGuardCheck<StepId, Form>[],
): void {
  describe(`${suiteLabel} (structural guard)`, () => {
    for (const check of checks) {
      it(check.name, () => {
        check.verify(config);
      });
    }
  });
}

/** Domain/file-system guards that do not use {@link WizardTestConfig}. */
export function describeStructuralGuard(
  suiteLabel: string,
  checks: readonly StructuralGuardRun[],
): void {
  describe(`${suiteLabel} (structural guard)`, () => {
    for (const check of checks) {
      it(check.name, check.run);
    }
  });
}
