import {
  assertCanonicalDocument,
  CanonicalDocumentValidationError,
  type CanonicalDocument,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import type { RenderStepPlan } from "../types/render-plan";
import type { RuleContext } from "../types/rule-context";
import type { ValidationResult } from "../types/validation-result";
import {
  assertCanonicalValueMatchesKind,
  getCanonicalValue,
  isEmptyCanonicalValue,
} from "../utils/canonical-path";
import { normalizeRuleContext } from "../utils/rule-context";
import { FieldRegistryEngine } from "./field-registry.engine";
import { RenderPlanBuilder } from "./render-plan.builder";
import { RuleEngine } from "./rule.engine";
import { assertWorkspacePluginForPlatform } from "./sdk-error-map";

/**
 * Facade for platform wizard engines. Apps must use this entry point only.
 *
 * Future: ValidationMode draft/submit and plugin.validation hooks (phase 3 API).
 */
export class PlatformWizardEngine {
  private readonly renderPlanBuilder: RenderPlanBuilder;

  private constructor(
    private readonly plugin: WorkspacePlugin,
    private readonly fieldEngine: FieldRegistryEngine,
    private readonly ruleEngine: RuleEngine,
  ) {
    this.renderPlanBuilder = new RenderPlanBuilder(
      plugin.wizard,
      fieldEngine,
      ruleEngine,
    );
  }

  static fromPlugin(plugin: WorkspacePlugin): PlatformWizardEngine {
    assertWorkspacePluginForPlatform(plugin);

    const fieldEngine = new FieldRegistryEngine(plugin.fieldRegistry);
    const ruleEngine = new RuleEngine(plugin.ruleSet, fieldEngine);
    return new PlatformWizardEngine(plugin, fieldEngine, ruleEngine);
  }

  buildRenderPlan(context: RuleContext): readonly RenderStepPlan[] {
    return this.renderPlanBuilder.build(normalizeRuleContext(context));
  }

  validateCanonical(document: CanonicalDocument, context: RuleContext): ValidationResult {
    try {
      assertCanonicalDocument(document);
    } catch (error) {
      if (error instanceof CanonicalDocumentValidationError) {
        return {
          ok: false,
          violations: [
            {
              code: error.code,
              message: error.message,
            },
          ],
        };
      }
      throw error;
    }

    const scope = this.ruleEngine.createScope(context);

    const violations: Array<{
      code: string;
      fieldId?: string;
      message: string;
    }> = [];

    for (const field of this.fieldEngine.listAll()) {
      const effective = scope.resolveEffectiveField(field.id);

      if (
        field.groupSlug != null &&
        this.plugin.wizard.inactiveFieldGroups.includes(field.groupSlug)
      ) {
        continue;
      }

      const hidden = effective.hidden;

      try {
        const value = getCanonicalValue(document.data, field.canonicalPath);
        if (value === undefined) {
          if (effective.required && !hidden) {
            violations.push({
              code: "UNKNOWN_CANONICAL_PATH",
              fieldId: field.id,
              message: `No value at canonical path "${field.canonicalPath}"`,
            });
          }
          continue;
        }

        if (
          !effective.required &&
          isEmptyCanonicalValue(value, field.kind, { enumOptions: field.enumOptions })
        ) {
          continue;
        }

        try {
          assertCanonicalValueMatchesKind(value, field.kind, field.canonicalPath, {
            enumOptions: field.enumOptions,
          });
        } catch (error) {
          if (error instanceof PlatformCoreError) {
            violations.push({
              code: error.code,
              fieldId: field.id,
              message: error.message,
            });
          } else {
            throw error;
          }
        }
      } catch (error) {
        if (error instanceof PlatformCoreError) {
          violations.push({
            code: error.code,
            fieldId: field.id,
            message: error.message,
          });
        } else {
          throw error;
        }
      }
    }

    return {
      ok: violations.length === 0,
      violations,
    };
  }
}
