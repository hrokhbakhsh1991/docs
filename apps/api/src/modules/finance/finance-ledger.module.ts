import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "../outbox/outbox.module";
import { AccountBalanceEntity } from "./ledger/entities/account-balance.entity";
import { LedgerJournalBatchEntity } from "./ledger/entities/ledger-journal-batch.entity";
import { LedgerJournalLineEntity } from "./ledger/entities/ledger-journal-line.entity";
import { BookingLedgerAuthorityService } from "./ledger/booking-ledger-authority.service";
import { PaymentCaptureLedgerAuthorityService } from "./ledger/payment-capture-ledger-authority.service";
import { PaymentRefundLedgerAuthorityService } from "./ledger/payment-refund-ledger-authority.service";

@Module({
  imports: [
    OutboxModule,
    TypeOrmModule.forFeature([LedgerJournalLineEntity, LedgerJournalBatchEntity, AccountBalanceEntity])
  ],
  providers: [
    BookingLedgerAuthorityService,
    PaymentCaptureLedgerAuthorityService,
    PaymentRefundLedgerAuthorityService
  ],
  exports: [
    BookingLedgerAuthorityService,
    PaymentCaptureLedgerAuthorityService,
    PaymentRefundLedgerAuthorityService
  ]
})
export class FinanceLedgerModule {}
