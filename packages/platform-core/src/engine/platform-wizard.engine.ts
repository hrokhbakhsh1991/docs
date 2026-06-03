import { parseWorkspacePluginFromStorage } from "@app-tour/workspace-sdk/ingress";
import type {
  CanonicalDocument,
  WorkspacePlugin,
} from "@app-tour/workspace-sdk/plugin-types";

import { validationResultFromPlatformError } from "../errors/ingress-bridge";
import { PlatformCoreError } from "../errors/platform-core.error";
import {
  platformFail,
  platformOk,
  unwrapPlatformResult,
  type PlatformResult,
} from "../errors/platform-result";
import {
  mapPluginIngressFailure,
  tryValidateWorkspacePluginForPlatform,
} from "../errors/sdk-error-map";
import type { RenderStepPlan } from "../types/render-plan";
import type { RuleContext } from "../types/rule-context";
import type { RuleContextResolution } from "../types/rule-context-resolution";
import type { ValidationResult } from "../types/validation-result";
import { normalizeRuleContext } from "../utils/rule-context";
import { FieldRegistryEngine } from "./field-registry.engine";
import { buildRenderPlan } from "./render-plan";
import { RuleEngine } from "./rule.engine";
import {
  DEFAULT_RULE_ENGINE_SCOPE_POLICY,
  type RuleEngineScopePolicy,
} from "./rule-engine-scope-policy";
import { validateCanonicalDocument } from "./validate-canonical-document";

/**
 * Reserved for Phase 2+ facade options. Phase 1 ignores all keys; pass `{}` or omit.
 */
export type PlatformWizardEngineOptions = Record<string, never>;

/** Package-internal — import from tests via relative path only (not in index.ts). */
export type PlatformWizardEngineInternalOptions = {
  readonly ruleEngineScopePolicy?: RuleEngineScopePolicy;
};

type WizardRuntime = {
  readonly plugin: WorkspacePlugin;
  readonly fieldEngine: FieldRegistryEngine;
  readonly ruleEngine: RuleEngine;
};

function sanitizePluginAtCreate(plugin: WorkspacePlugin): WorkspacePlugin {
  try {
    return parseWorkspacePluginFromStorage(plugin, { includeTheme: false });
  } catch (error: unknown) {
    const mapped = mapPluginIngressFailure(error);
    if (mapped != null && !mapped.ok) {
      throw mapped.error;
    }
    throw error;
  }
}

/**
 * Facade for platform wizard engines. Importing this module performs no plugin work.
 *
 * - {@link PlatformWizardEngine.create} — clones/freezes plugin at construction; engines on first `tryInit`.
 * - {@link PlatformWizardEngine.tryFromPlugin} — eager bootstrap (`tryInit` before return).
 * - **One engine per tenant session** — pass `tenantId` on every `RuleContext`; do not share across tenants.
 * - Init failures are **not** cached; each `tryInit` re-attempts `buildRuntime`.
 */
export class PlatformWizardEngine {
  private readonly ruleEngineScopePolicy: RuleEngineScopePolicy;
  private readonly pluginInput: WorkspacePlugin;
  private runtime: WizardRuntime | null = null;

  private constructor(
    plugin: WorkspacePlugin,
    options: PlatformWizardEngineInternalOptions,
  ) {
    this.pluginInput = sanitizePluginAtCreate(plugin);
    this.ruleEngineScopePolicy =
      options.ruleEngineScopePolicy ?? DEFAULT_RULE_ENGINE_SCOPE_POLICY;
  }

  /** Clones plugin via headless ingress — does not build field/rule engines until `tryInit`. */
  static create(
    plugin: WorkspacePlugin,
    options: PlatformWizardEngineOptions = {},
  ): PlatformWizardEngine {
    return new PlatformWizardEngine(plugin, options);
  }

  /** Package-internal — not exported from index.ts. */
  static createForTests(
    plugin: WorkspacePlugin,
    options: PlatformWizardEngineInternalOptions = {},
  ): PlatformWizardEngine {
    return new PlatformWizardEngine(plugin, options);
  }

  isInitialized(): boolean {
    return this.runtime != null;
  }

  tryInit(): PlatformResult<void> {
    if (this.runtime != null) {
      return platformOk(undefined);
    }

    const built = this.buildRuntime();
    if (!built.ok) {
      return platformFail(built.error.code, built.error.message, built.error.details);
    }

    this.runtime = built.value;
    return platformOk(undefined);
  }

  init(): void {
    unwrapPlatformResult(this.tryInit());
  }

  static tryFromPlugin(
    plugin: WorkspacePlugin,
    options: PlatformWizardEngineOptions = {},
  ): PlatformResult<PlatformWizardEngine> {
    let engine: PlatformWizardEngine;
    try {
      engine = PlatformWizardEngine.create(plugin, options);
    } catch (error: unknown) {
      if (error instanceof PlatformCoreError) {
        return platformFail(error.code, error.message, error.details);
      }
      throw error;
    }
    const initialized = engine.tryInit();
    if (!initialized.ok) {
      return initialized;
    }
    return platformOk(engine);
  }

  tryBuildRenderPlan(context: RuleContext): PlatformResult<readonly RenderStepPlan[]> {
    const ready = this.tryEnsureRuntime();
    if (!ready.ok) {
      return ready;
    }
    try {
      const resolution = normalizeRuleContext(context);
      const { plugin, fieldEngine, ruleEngine } = ready.value;
      return platformOk(
        buildRenderPlan(plugin.wizard, fieldEngine, ruleEngine, resolution),
      );
    } catch (error: unknown) {
      if (error instanceof PlatformCoreError) {
        return platformFail(error.code, error.message, error.details);
      }
      throw error;
    }
  }

  buildRenderPlan(context: RuleContext): readonly RenderStepPlan[] {
    return unwrapPlatformResult(this.tryBuildRenderPlan(context));
  }

  validateCanonical(document: CanonicalDocument, context: RuleContext): ValidationResult {
    const ready = this.tryEnsureRuntime();
    if (!ready.ok) {
      return validationResultFromPlatformError(ready.error);
    }

    const resolution = normalizeRuleContext(context) as RuleContextResolution;
    return validateCanonicalDocument({
      plugin: ready.value.plugin,
      fieldEngine: ready.value.fieldEngine,
      ruleEngine: ready.value.ruleEngine,
      document,
      context: resolution,
    });
  }

  private tryEnsureRuntime(): PlatformResult<WizardRuntime> {
    const init = this.tryInit();
    if (!init.ok) {
      return platformFail(init.error.code, init.error.message, init.error.details);
    }
    return platformOk(this.runtime!);
  }

  private buildRuntime(): PlatformResult<WizardRuntime> {
    const validated = tryValidateWorkspacePluginForPlatform(this.pluginInput);
    if (!validated.ok) {
      return validated;
    }

    const fieldEngine = FieldRegistryEngine.tryCreate(validated.value.fieldRegistry);
    if (!fieldEngine.ok) {
      return fieldEngine;
    }

    const ruleEngine = RuleEngine.tryCreate(
      validated.value.ruleSet,
      fieldEngine.value,
      this.ruleEngineScopePolicy,
    );
    if (!ruleEngine.ok) {
      return ruleEngine;
    }

    return platformOk({
      plugin: validated.value,
      fieldEngine: fieldEngine.value,
      ruleEngine: ruleEngine.value,
    });
  }
}

/** Package-internal test factory — not exported from index.ts. */
export function createPlatformWizardEngineForTests(
  plugin: WorkspacePlugin,
  options: PlatformWizardEngineInternalOptions = {},
): PlatformWizardEngine {
  return PlatformWizardEngine.createForTests(plugin, options);
}
