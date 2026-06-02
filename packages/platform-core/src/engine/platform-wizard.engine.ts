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
import { ValidationStatusMap } from "./validation-status-map";

const MAX_ALLOWED_REGISTRY_FIELDS = 1000;

/**
 * Facade for platform wizard engines. Apps must use this entry point only.
 *
 * Future: ValidationMode draft/submit and plugin.validation hooks (phase 3 API).
 */
export class PlatformWizardEngine {
  private readonly renderPlanBuilder: RenderPlanBuilder;
  private readonly validationStatus = new ValidationStatusMap();

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
    if (fieldEngine.listAll().length > MAX_ALLOWED_REGISTRY_FIELDS) {
      throw new PlatformCoreError(
        "REGISTRY_CARDINALITY_VIOLATION",
        `fieldRegistry.fields exceeds maximum allowed count (${MAX_ALLOWED_REGISTRY_FIELDS})`,
        { fieldCount: fieldEngine.listAll().length },
      );
    }

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

    const fieldCount = this.fieldEngine.listAll().length;
    if (fieldCount > MAX_ALLOWED_REGISTRY_FIELDS) {
      return {
        ok: false,
        violations: [
          {
            code: "REGISTRY_CARDINALITY_VIOLATION",
            message: `fieldRegistry.fields exceeds maximum allowed count (${MAX_ALLOWED_REGISTRY_FIELDS})`,
          },
        ],
      };
    }

    const scope = this.ruleEngine.createScope(context);
    this.validationStatus.reset();

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

        if (hidden && value !== undefined) {
          if (field.kind !== "composite") {
            this.validationStatus.record(
              "HIDDEN_FIELD_POISON",
              field.id,
              `Hidden field "${field.id}" must not contain a value at "${field.canonicalPath}"`,
            );
            continue;
          }
        }

        if (value === undefined) {
          if (effective.required && !hidden) {
            this.validationStatus.record(
              "UNKNOWN_CANONICAL_PATH",
              field.id,
              `No value at canonical path "${field.canonicalPath}"`,
            );
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
            this.validationStatus.record(error.code, field.id, error.message);
          } else {
            throw error;
          }
        }
      } catch (error) {
        if (error instanceof PlatformCoreError) {
          this.validationStatus.record(error.code, field.id, error.message);
        } else {
          throw error;
        }
      }
    }

    return this.validationStatus.finalize();
  }
}
