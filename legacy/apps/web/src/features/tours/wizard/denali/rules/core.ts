/**
 * Intra-rules barrel (leaf modules only — excludes denaliUIAdapter to avoid import cycles).
 * Prefer `import { … } from "./core"` inside rules/; external callers use `./index`.
 */

export {
  canonicalDurationToRuleModelDuration,
  getDenaliRulesFromCanonical,
  ruleModelDurationToCanonicalDuration,
} from "./denaliCanonicalRuleAdapter";

export { canonicalZodPathToFormFieldPath } from "./denaliCanonicalPathLookup";

export {
  mapDenaliCanonicalToFormPath,
  mapFormPathToCanonical,
} from "./denaliCanonicalPaths";

export {
  evaluateDenaliContextualRequired,
  evaluateDenaliContextualRule,
  evaluateDenaliContextualVisibility,
  getDenaliFieldDefinitionByCanonicalPath,
  type DenaliUIContextOptions,
} from "./denaliContextualRules";

export {
  DENALI_TEMPLATE_SCHEMA,
  deriveDenaliTemplateSchema,
  listDenaliTemplateCanonicalFieldPaths,
  type DenaliTemplateSchema,
  type DenaliTemplateSchemaField,
  type DenaliTemplateSchemaModel,
} from "./deriveDenaliTemplateSchema";

export {
  isDenaliFieldRequired,
  isDenaliFieldVisibleInModel,
} from "./denaliFieldGate";

export {
  assertUniqueDenaliFieldPaths,
  denaliRuleModelMountainMultiDay,
  denaliRuleSet,
  findDenaliRuleField,
  listDenaliRuleFieldPaths,
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  DENALI_RULE_MODEL_VERSION,
  type DenaliRuleFieldDefinition,
  type DenaliRuleFieldStep,
  type DenaliRuleModel,
  type DenaliRuleModelCategory,
  type DenaliRuleModelDuration,
  type DenaliRuleModelKey,
  type DenaliRuleSet,
} from "./denaliRuleModel";

export {
  collectDenaliRuleRequiredIssues,
  DENALI_WIZARD_CANONICAL_FIELD_PATHS,
  DENALI_WIZARD_FORM_FIELD_PATHS,
  readDenaliFormFieldValue,
  writeDenaliFormFieldValue,
  type DenaliRuleRequiredIssue,
  type DenaliRuleValidationScope,
} from "./denaliRuleRequired";
