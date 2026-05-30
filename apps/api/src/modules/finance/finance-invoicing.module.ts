import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { BookingPriceSnapshotEntity } from "../pricing/entities/booking-price-snapshot.entity";
import { LedgerJournalLineEntity } from "./ledger/entities/ledger-journal-line.entity";
import { INVOICE_READ_MODEL_PORT } from "./domain/ports/invoice-read-model.port";
import { TypeOrmInvoiceReadModelRepository } from "./repositories/typeorm-invoice-read-model.repository";
import { FinanceInvoicesController } from "./invoicing/finance-invoices.controller";

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([BookingPriceSnapshotEntity, LedgerJournalLineEntity]),
  ],
  controllers: [FinanceInvoicesController],
  providers: [
    TypeOrmInvoiceReadModelRepository,
    {
      provide: INVOICE_READ_MODEL_PORT,
      useExisting: TypeOrmInvoiceReadModelRepository,
    },
  ],
  exports: [INVOICE_READ_MODEL_PORT],
})
export class FinanceInvoicingModule {}
