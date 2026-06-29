import { evaluateSimpleCondition } from "./evaluate-simple-condition";
import type {
  FieldDefinition,
  FieldPolicyRule,
  FieldPolicyState,
  ResolvedFieldState,
  ResolveFieldStateInput,
} from "./types";

const STATE_PRECEDENCE: Readonly<Record<FieldPolicyState, number>> = {
  hidden: 0,
  visible: 1,
  readonly: 2,
  required: 3,
};

function compareRules(left: FieldPolicyRule, right: FieldPolicyRule): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  const stateComparison = STATE_PRECEDENCE[left.state] - STATE_PRECEDENCE[right.state];
  if (stateComparison !== 0) {
    return stateComparison;
  }
  return right.id.localeCompare(left.id);
}

function shouldIncludeDefinition(
  definition: FieldDefinition,
  input: ResolveFieldStateInput,
  requested: ReadonlySet<string> | null,
): boolean {
  if (definition.workspaceType !== input.workspaceType) {
    return false;
  }
  return requested === null || requested.has(definition.id);
}

function ruleMatchesInput(rule: FieldPolicyRule, input: ResolveFieldStateInput): boolean {
  return (
    rule.enabled &&
    rule.workspaceType === input.workspaceType &&
    rule.surface === input.surface &&
    evaluateSimpleCondition(rule.condition, input.entityState)
  );
}

export function resolveFieldState(input: ResolveFieldStateInput): readonly ResolvedFieldState[] {
  const requested =
    input.requestedFieldIds == null ? null : new Set<string>(input.requestedFieldIds);

  const definitions = input.definitions
    .filter((definition) => shouldIncludeDefinition(definition, input, requested))
    .sort((left, right) => left.id.localeCompare(right.id));

  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const matchingRules = input.rules.filter(
    (rule) => definitionIds.has(rule.fieldId) && ruleMatchesInput(rule, input),
  );

  return definitions.map((definition) => {
    let winningRule: FieldPolicyRule | undefined;

    for (const rule of matchingRules) {
      if (rule.fieldId !== definition.id) {
        continue;
      }
      if (winningRule == null || compareRules(winningRule, rule) < 0) {
        winningRule = rule;
      }
    }

    return {
      fieldId: definition.id,
      canonicalPath: definition.canonicalPath,
      state: winningRule?.state ?? "hidden",
      ...(winningRule == null ? {} : { reasonRuleId: winningRule.id }),
    };
  });
}
