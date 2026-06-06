/**
 * Intra-rules barrel (slim — 6.2 parity surface only).
 */

export {
  canonicalDurationToRuleModelDuration,
  getDenaliRulesFromCanonical,
  ruleModelDurationToCanonicalDuration,
} from "./denaliCanonicalRuleAdapter";

export { canonicalZodPathToFormFieldPath } from "./denaliCanonicalPathLookup";

export { mapDenaliCanonicalToFormPath, mapFormPathToCanonical } from "./denaliCanonicalPaths";

export {
  evaluateDenaliContextualRequired,
  evaluateDenaliContextualRule,
  evaluateDenaliContextualVisibility,
  getDenaliFieldDefinitionByCanonicalPath,
  type DenaliUIContextOptions,
} from "./denaliContextualRules";

export { isDenaliFieldRequired, isDenaliFieldVisibleInModel } from "./denaliFieldGate";

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
