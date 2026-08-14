/**
 * Case evidence fact provider — proof facts only.
 * Not receipt submit/approve command ports.
 */

import type { EvidenceFacts } from "../facts/fact-groups";
import type { CaseFactProviderResult, CaseFactReadScope } from "./case-fact-read-scope";

export interface CaseEvidenceFactPort {
  readEvidenceFacts(scope: CaseFactReadScope): Promise<CaseFactProviderResult<EvidenceFacts>>;
}
