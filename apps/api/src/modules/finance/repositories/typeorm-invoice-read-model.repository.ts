import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BookingPriceSnapshotEntity } from "../../pricing/entities/booking-price-snapshot.entity";
import { LedgerJournalLineEntity } from "../ledger/entities/ledger-journal-line.entity";
import { ledgerJournalLineEntityToDomain } from "../ledger/repositories/ledger-journal-line.mapper";
import { normalizeFinanceTenantId } from "../ledger/ledger-tenant-scope";
import { issueImmutableInvoice } from "../invoicing/immutable-invoice";
import { parseBookingIdFromWalletAccount } from "../invoicing/parse-booking-wallet-id";
import { computePaidAndBalanceDueMinor } from "../invoicing/compile-invoice-balances";
import type {
  ImmutableInvoiceSnapshot,
  InvoiceReadModelPort,
} from "../domain/ports/invoice-read-model.port";

@Injectable()
export class TypeOrmInvoiceReadModelRepository implements InvoiceReadModelPort {
  constructor(
    @InjectRepository(BookingPriceSnapshotEntity)
    private readonly snapshots: Repository<BookingPriceSnapshotEntity>,
    @InjectRepository(LedgerJournalLineEntity)
    private readonly ledgerLines: Repository<LedgerJournalLineEntity>
  ) {}

  async getDerivedInvoice(
    bookingWalletId: string,
    tenantId: string
  ): Promise<ImmutableInvoiceSnapshot> {
    const tenantNorm = normalizeFinanceTenantId(tenantId);
    const walletAccount = bookingWalletId.trim();
    const bookingId = parseBookingIdFromWalletAccount(walletAccount);

    const snapshot = await this.snapshots
      .createQueryBuilder("s")
      .where("s.tenant_id = :tenantId", { tenantId: tenantNorm })
      .andWhere("s.booking_id = :bookingId", { bookingId })
      .orderBy("s.created_at", "DESC")
      .addOrderBy("s.snapshot_id", "DESC")
      .getOne();

    if (!snapshot) {
      throw new NotFoundException({
        error: {
          code: "INVOICE_SNAPSHOT_NOT_FOUND",
          message: "No immutable booking price snapshot exists for this wallet in tenant scope",
        },
      });
    }

    if (snapshot.tenantId.trim().toLowerCase() !== tenantNorm) {
      throw new NotFoundException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Invoice snapshot is outside trusted tenant scope",
        },
      });
    }

    const lineRows = await this.ledgerLines.find({
      where: { tenantId: tenantNorm, account: walletAccount },
      order: { createdAt: "ASC", id: "ASC" },
    });

    const ledgerLines = lineRows.map(ledgerJournalLineEntityToDomain);
    const invoice = issueImmutableInvoice({
      tenantId: tenantNorm,
      bookingId,
      snapshot: {
        snapshotId: snapshot.snapshotId,
        tenantId: snapshot.tenantId,
        bookingId: snapshot.bookingId,
        computedTotalMinor: snapshot.computedTotalMinor,
        currency: snapshot.currency,
        pricingRuleVersion: snapshot.pricingRuleVersion,
        listPriceMinor: snapshot.listPriceMinor,
        createdAt: snapshot.createdAt,
      },
      ledgerLines,
    });

    const { paidAmountMinor, balanceDueMinor } = computePaidAndBalanceDueMinor(
      invoice.totals.invoiceTotalMinor,
      invoice.totals.bookingWalletNetMinor
    );

    return {
      tenantId: tenantNorm,
      bookingWalletId: walletAccount,
      bookingId,
      snapshotId: snapshot.snapshotId,
      currency: invoice.totals.currency,
      invoiceTotalMinor: invoice.totals.invoiceTotalMinor,
      paidAmountMinor,
      balanceDueMinor,
      issuedAtIso: invoice.issuedAtIso,
      invoice,
    };
  }
}
