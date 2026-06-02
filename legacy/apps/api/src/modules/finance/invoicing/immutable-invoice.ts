import { createHash } from "node:crypto";
import type { BookingPriceSnapshotEntity } from "../../pricing/entities/booking-price-snapshot.entity";
import { bookingWalletId } from "../ledger/booking-ledger-authority.service";
import { assertLedgerLinesFinanceTenantScope } from "../ledger/ledger-tenant-scope";
import type { LedgerJournalLine } from "../ledger/ledger-journal-line";
import { sumWalletBalanceFromLedgerLines } from "../ledger/wallet-projection";

export const IMMUTABLE_INVOICE_SCHEMA_VERSION = 1 as const;

/**
 * Canonical snapshot binding carried on every invoice (derived artifact must cite immutable price fact).
 */
export type ImmutableInvoiceSnapshotRef = {
  readonly snapshotId: string;
  readonly bookingId: string;
  readonly tenantId: string;
  readonly computedTotalMinor: string;
  readonly currency: string;
  readonly pricingRuleVersion: string;
  readonly listPriceMinor: string;
  readonly snapshotCreatedAtIso: string;
};

export type ImmutableInvoiceLedgerLineRef = {
  readonly id: string;
  readonly journalId: string;
  readonly account: string;
  readonly side: LedgerJournalLine["side"];
  readonly amount_minor: string;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly correlationId: string;
  readonly reversesLineId?: string;
};

export type ImmutableInvoiceIntegrity = {
  readonly algorithm: "sha256-hex";
  /** Stable digest of the invoice payload (all fields except `integrity`). */
  readonly contentHash: string;
};

/**
 * **Derived read model only** — materialized from authoritative {@link BookingPriceSnapshotEntity} facts
 * plus in-process / replayed {@link LedgerJournalLine} slices. Must never drive money movement or outbox.
 */
export type ImmutableInvoice = {
  readonly invoiceId: string;
  readonly schemaVersion: typeof IMMUTABLE_INVOICE_SCHEMA_VERSION;
  /** Always true — discriminant for serializers / workers. */
  readonly derivedArtifact: true;
  readonly issuedAtIso: string;
  readonly snapshot: ImmutableInvoiceSnapshotRef;
  /** Ledger lines scoped to this tenant + booking wallet (subset fingerprinted for audit). */
  readonly ledgerLines: readonly ImmutableInvoiceLedgerLineRef[];
  readonly totals: {
    readonly invoiceTotalMinor: string;
    readonly currency: string;
    /** Wallet net from supplied lines (informational; may diverge after snapshot if further ledger posts exist). */
    readonly bookingWalletNetMinor: string;
  };
  readonly integrity: ImmutableInvoiceIntegrity;
};

export type IssueImmutableInvoiceInput = {
  tenantId: string;
  bookingId: string;
  /**
   * Immutable booking-time price row (append-only in DB). `snapshotId` is mandatory — invoices cannot
   * be issued without an explicit snapshot reference.
   */
  snapshot: Pick<
    BookingPriceSnapshotEntity,
    | "snapshotId"
    | "tenantId"
    | "bookingId"
    | "computedTotalMinor"
    | "currency"
    | "pricingRuleVersion"
    | "listPriceMinor"
    | "createdAt"
  >;
  /** Ledger slice already filtered by caller (typically lines touching this booking / tenant). */
  ledgerLines: readonly LedgerJournalLine[];
  issuedAt?: Date;
};

function snapshotCreatedAtIso(createdAt: Date): string {
  return createdAt.toISOString();
}

function toLedgerLineRef(line: LedgerJournalLine): ImmutableInvoiceLedgerLineRef {
  const ref: ImmutableInvoiceLedgerLineRef = {
    id: line.id,
    journalId: line.journalId,
    account: line.account,
    side: line.side,
    amount_minor: line.amount_minor,
    currency: line.currency,
    idempotencyKey: line.idempotencyKey,
    createdAt: line.createdAt,
    correlationId: line.correlationId
  };
  if (line.reversesLineId !== undefined) {
    return { ...ref, reversesLineId: line.reversesLineId };
  }
  return ref;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableStringify(x)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function deepFreezeInvoice<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item !== null && typeof item === "object") {
          deepFreezeInvoice(item as Record<string, unknown>);
        }
      }
      Object.freeze(v);
    } else if (v !== null && typeof v === "object") {
      deepFreezeInvoice(v as Record<string, unknown>);
    }
  }
  return Object.freeze(obj) as T;
}

function assertSnapshotRef(input: IssueImmutableInvoiceInput): ImmutableInvoiceSnapshotRef {
  const sid = input.snapshot.snapshotId.trim();
  if (sid === "") {
    throw new Error("INVOICE_SNAPSHOT_REQUIRED: immutable invoice requires a non-empty snapshotId");
  }
  const tenantId = input.tenantId.trim();
  const bookingId = input.bookingId.trim();
  if (input.snapshot.tenantId.trim() !== tenantId) {
    throw new Error("INVOICE_SNAPSHOT_TENANT_MISMATCH: snapshot.tenantId must match invoice tenantId");
  }
  if (input.snapshot.bookingId.trim() !== bookingId) {
    throw new Error("INVOICE_SNAPSHOT_BOOKING_MISMATCH: snapshot.bookingId must match invoice bookingId");
  }
  const currency = input.snapshot.currency.trim().toUpperCase();
  if (currency === "") {
    throw new Error("INVOICE_SNAPSHOT_CURRENCY_REQUIRED");
  }
  return {
    snapshotId: sid,
    bookingId,
    tenantId,
    computedTotalMinor: input.snapshot.computedTotalMinor.trim(),
    currency,
    pricingRuleVersion: input.snapshot.pricingRuleVersion.trim(),
    listPriceMinor: input.snapshot.listPriceMinor.trim(),
    snapshotCreatedAtIso: snapshotCreatedAtIso(input.snapshot.createdAt)
  };
}

function filterLedgerLinesForBooking(
  tenantId: string,
  bookingId: string,
  lines: readonly LedgerJournalLine[]
): ImmutableInvoiceLedgerLineRef[] {
  const wallet = bookingWalletId(bookingId);
  const t = tenantId.trim();
  const out: ImmutableInvoiceLedgerLineRef[] = [];
  for (const line of lines) {
    if (line.tenantId.trim() !== t) continue;
    if (line.account.trim() !== wallet) continue;
    out.push(toLedgerLineRef(line));
  }
  return out;
}

function deterministicInvoiceId(tenantId: string, snapshotId: string, issuedAtIso: string): string {
  const raw = `invoice|v${IMMUTABLE_INVOICE_SCHEMA_VERSION}|${tenantId}|${snapshotId}|${issuedAtIso}`;
  const hex = createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 32);
  return `inv_${hex}`;
}

export type ImmutableInvoiceContentForHash = Omit<ImmutableInvoice, "integrity">;

function contentHashForInvoice(content: ImmutableInvoiceContentForHash): string {
  return createHash("sha256").update(stableStringify(content), "utf8").digest("hex");
}

/**
 * Builds and **seals** an immutable invoice: snapshot reference is mandatory; ledger lines are fingerprinted;
 * object is frozen and carries a **content hash** for tamper-evident storage/transport.
 *
 * **Non-authoritative:** callers must not use return values to mutate balances, outbox, or payments.
 */
export function issueImmutableInvoice(input: IssueImmutableInvoiceInput): ImmutableInvoice {
  const issuedAt = input.issuedAt ?? new Date();
  const issuedAtIso = issuedAt.toISOString();
  const snapshot = assertSnapshotRef(input);
  assertLedgerLinesFinanceTenantScope(snapshot.tenantId, input.ledgerLines);
  const ledgerRefs = filterLedgerLinesForBooking(input.tenantId, input.bookingId, input.ledgerLines);
  const wallet = sumWalletBalanceFromLedgerLines(
    snapshot.tenantId,
    bookingWalletId(snapshot.bookingId),
    [...input.ledgerLines]
  );

  const invoiceId = deterministicInvoiceId(snapshot.tenantId, snapshot.snapshotId, issuedAtIso);

  const content: ImmutableInvoiceContentForHash = {
    invoiceId,
    schemaVersion: IMMUTABLE_INVOICE_SCHEMA_VERSION,
    derivedArtifact: true,
    issuedAtIso,
    snapshot,
    ledgerLines: ledgerRefs,
    totals: {
      invoiceTotalMinor: snapshot.computedTotalMinor,
      currency: snapshot.currency,
      bookingWalletNetMinor: wallet.balance_minor.trim() || "0"
    }
  };

  const sealed: ImmutableInvoice = {
    ...content,
    integrity: {
      algorithm: "sha256-hex",
      contentHash: contentHashForInvoice(content)
    }
  };

  return deepFreezeInvoice(sealed as unknown as Record<string, unknown>) as unknown as ImmutableInvoice;
}

/**
 * Verifies an invoice object’s `integrity.contentHash` still matches its payload (post-deserialization check).
 */
export function verifyImmutableInvoiceIntegrity(invoice: ImmutableInvoice): boolean {
  const rest: ImmutableInvoiceContentForHash = {
    invoiceId: invoice.invoiceId,
    schemaVersion: invoice.schemaVersion,
    derivedArtifact: invoice.derivedArtifact,
    issuedAtIso: invoice.issuedAtIso,
    snapshot: invoice.snapshot,
    ledgerLines: invoice.ledgerLines,
    totals: invoice.totals
  };
  return invoice.integrity.contentHash === contentHashForInvoice(rest);
}
