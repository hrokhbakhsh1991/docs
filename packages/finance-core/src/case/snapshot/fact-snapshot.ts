/**
 * Fact snapshot + encounter metadata.
 * Attention signals are segregated and never enter verdict inputs.
 */

import type { CaseFacts } from "../facts/fact-groups";

export type EncounterMode = "lookup" | "attention" | "escalation" | "audit";

/**
 * Discovery-only. Changing attentionClass with identical facts must not
 * change CaseOutput reading / owner / posture.
 */
export type EncounterAttention = {
  readonly attentionClass: string;
  readonly reasonCode?: string;
};

export type EncounterMetadata = {
  readonly mode: EncounterMode;
  readonly attention?: EncounterAttention;
};

export type FactSnapshot = {
  readonly facts: CaseFacts;
  readonly encounter: EncounterMetadata;
};
