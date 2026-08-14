/**
 * Denali ledger / recon SoT → AuditCueFacts only.
 * Never approve, repair, or command.
 */

import type { DenaliLedgerSource } from "./denali-case-read-sources";
import { knownFact, unknownFact } from "./fact-tokens";
import type { AuditCueFacts } from "./portable-facts";
import { unknownAuditCues } from "./unknown-fact-groups";

export function mapDenaliLedgerToAuditCues(source: DenaliLedgerSource): AuditCueFacts {
  if (source.readStatus === "failed") {
    return unknownAuditCues("ledger_read_failed");
  }
  if (source.readStatus === "missing") {
    return unknownAuditCues("ledger_sot_missing");
  }

  const ledgerRefsPresent =
    source.ledgerRefsPresent === null || source.ledgerRefsPresent === undefined
      ? unknownFact("ledger_refs_unread")
      : knownFact(source.ledgerRefsPresent);

  const reconFinding =
    source.reconFinding === null || source.reconFinding === undefined
      ? unknownFact("recon_unread")
      : knownFact(source.reconFinding);

  return { ledgerRefsPresent, reconFinding };
}
