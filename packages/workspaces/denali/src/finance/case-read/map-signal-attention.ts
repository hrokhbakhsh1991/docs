/**
 * Denali attention / discovery SoT → EncounterAttention only.
 * Never writes CaseFacts.
 */

import type { DenaliSignalSource } from "./denali-case-read-sources";
import type { CaseSignalFactBundle } from "./portable-facts";
import { unknownSignalBundle } from "./unknown-fact-groups";

export function mapDenaliSignalToAttention(source: DenaliSignalSource): CaseSignalFactBundle {
  if (source.readStatus === "failed") {
    // Discovery failure must not invent attention; null attention is safe.
    return unknownSignalBundle();
  }
  if (source.readStatus === "missing") {
    return unknownSignalBundle();
  }

  const cls = source.attentionClass;
  if (cls === null || cls === undefined || cls.trim().length === 0) {
    return { attention: null };
  }

  return {
    attention: {
      attentionClass: cls.trim(),
      ...(source.reasonCode !== null &&
      source.reasonCode !== undefined &&
      source.reasonCode.trim().length > 0
        ? { reasonCode: source.reasonCode.trim() }
        : {}),
    },
  };
}
