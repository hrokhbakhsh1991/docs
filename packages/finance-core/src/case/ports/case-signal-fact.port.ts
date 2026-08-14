/**
 * Case signal fact provider — discovery / encounter attention only.
 * Output must not enter interpret verdict inputs (facts.*).
 */

import type { EncounterAttention } from "../snapshot/fact-snapshot";
import type { CaseFactProviderResult, CaseFactReadScope } from "./case-fact-read-scope";

export type CaseSignalFactBundle = {
  /** null = no attention for this encounter (e.g. pure lookup). */
  readonly attention: EncounterAttention | null;
};

export interface CaseSignalFactPort {
  readAttention(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CaseSignalFactBundle>>;
}
