import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import {
  createPlatformWizardEngineForTests,
  type PlatformWizardEngineInternalOptions,
} from "../src/engine/platform-wizard.engine.js";
import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine.js";
import type { RuleEngineScopePolicy } from "../src/engine/rule-engine-scope-policy.js";
import { unwrapPlatformResult } from "../src/errors/platform-result.js";
import { RULE_ENGINE_TEST_SCOPE_POLICY } from "./rule-engine-test-policy.js";

export type PlatformTestDeps = PlatformWizardEngineInternalOptions;

const TEST_DEFAULTS: PlatformTestDeps = Object.freeze({
  ruleEngineScopePolicy: RULE_ENGINE_TEST_SCOPE_POLICY,
});

/** Test harness: create + init with injectable scope policy (not on public API). */
export function createInitializedPlatformWizard(
  plugin: WorkspacePlugin,
  deps: PlatformTestDeps = TEST_DEFAULTS,
): PlatformWizardEngine {
  const engine = createPlatformWizardEngineForTests(plugin, deps);
  unwrapPlatformResult(engine.tryInit());
  return engine;
}

export type { RuleEngineScopePolicy };
