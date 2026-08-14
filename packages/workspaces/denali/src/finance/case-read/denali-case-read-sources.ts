/**
 * Denali SoT DTO shapes for Case fact mapping.
 * Host loads persistence; these types carry opaque string ids only —
 * no registrationId / member / tour domain branding in portable facts.
 */

/** How the host load completed before mapping. */
export type DenaliCaseReadStatus = "ok" | "missing" | "failed";

/**
 * Commercial obligation projection for one enrollment money-meaning.
 * Amounts are minor-unit decimal strings when known.
 */
export type DenaliObligationSource = {
  readonly readStatus: DenaliCaseReadStatus;
  /** Opaque subject id (registration) — mapper copies into scope facts only via host. */
  readonly subjectId?: string;
  readonly counterpartyId?: string;
  /** When free collection, expect obligationMinor "0". */
  readonly collectionMode?: "offline" | "free";
  readonly obligationMinor?: string | null;
  /** Distinct from obligation: remaining after settlement contributors. null = unread. */
  readonly remainingMinor?: string | null;
  readonly currency?: string | null;
  readonly scheduleKind?: "none" | "installments" | "cycle" | "other" | null;
  readonly partialScopeDeclared?: boolean | null;
};

export type DenaliPaymentRowSource = {
  readonly id: string;
  readonly status: string;
  readonly method: string;
  readonly provider: string;
  readonly amountMinor?: string;
};

/**
 * Payment / intent / booking-payment sync contributors.
 * Settlement meaning is a fact projection — not a Case "settled" verdict.
 */
export type DenaliPaymentSource = {
  readonly readStatus: DenaliCaseReadStatus;
  readonly payments?: readonly DenaliPaymentRowSource[] | null;
  /** Booking payment projection: unpaid | partial | paid (opaque string). */
  readonly bookingPaymentStatus?: string | null;
};

export type DenaliReceiptRowSource = {
  readonly id: string;
  readonly status: string;
  readonly fileKey: string;
  readonly reviewedAt?: string | null;
};

/**
 * Evidence/receipt SoT.
 * Missing receipt row with ok read → absent. failed → unknown.
 */
export type DenaliEvidenceSource = {
  readonly readStatus: DenaliCaseReadStatus;
  /** null/undefined when no receipt exists for the subject. */
  readonly receipt?: DenaliReceiptRowSource | null;
};

/**
 * Lifecycle eligibility projection only — never full Denali FSM.
 * leftoverArtifactsProven: only when SoT can assert closed + leftovers.
 */
export type DenaliLifecycleSource = {
  readonly readStatus: DenaliCaseReadStatus;
  /** Booking status wire: pending | approved | waitlisted | rejected | cancelled. */
  readonly bookingStatus?: string | null;
  readonly leftoverArtifactsProven?: boolean | null;
  readonly meaningConflictProven?: boolean | null;
};

export type DenaliLedgerSource = {
  readonly readStatus: DenaliCaseReadStatus;
  readonly ledgerRefsPresent?: boolean | null;
  readonly reconFinding?: "none" | "mismatch" | null;
};

/**
 * Discovery attention only — never CaseFacts.
 */
export type DenaliSignalSource = {
  readonly readStatus: DenaliCaseReadStatus;
  readonly attentionClass?: string | null;
  readonly reasonCode?: string | null;
};
