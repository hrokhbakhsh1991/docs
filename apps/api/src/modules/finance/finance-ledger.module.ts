import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "../outbox/outbox.module";
import { RegistrationFinancePortsModule } from "../registrations/registration-finance-ports.module";
import { AccountBalanceEntity } from "./ledger/entities/account-balance.entity";
import { LedgerJournalBatchEntity } from "./ledger/entities/ledger-journal-batch.entity";
import { LedgerJournalLineEntity } from "./ledger/entities/ledger-journal-line.entity";
import { BookingLedgerAuthorityService } from "./ledger/booking-ledger-authority.service";
import { PaymentCaptureLedgerAuthorityService } from "./ledger/payment-capture-ledger-authority.service";
import { PaymentRefundLedgerAuthorityService } from "./ledger/repositories/payment-refund-ledger-authority.service";
import { LedgerCommandBus } from "./ledger/ledger-command-bus";
import { PaymentLedgerSyncListener } from "./repositories/payment-ledger-sync.listener";
import { RegistrationCreatedLedgerListener } from "./listeners/registration-created-ledger.listener";
import { BookingFinalizedLedgerListener } from "./listeners/booking-finalized-ledger.listener";
import { RegistrationPaymentUpdatedLedgerListener } from "./listeners/registration-payment-updated-ledger.listener";

@Module({
  imports: [
    forwardRef(() => OutboxModule),
    RegistrationFinancePortsModule,
    TypeOrmModule.forFeature([LedgerJournalLineEntity, LedgerJournalBatchEntity, AccountBalanceEntity])
  ],
  providers: [
    BookingLedgerAuthorityService,
    PaymentCaptureLedgerAuthorityService,
    PaymentRefundLedgerAuthorityService,
    LedgerCommandBus,
    PaymentLedgerSyncListener,
    RegistrationCreatedLedgerListener,
    BookingFinalizedLedgerListener,
    RegistrationPaymentUpdatedLedgerListener,
  ],
  exports: [
    BookingLedgerAuthorityService,
    PaymentCaptureLedgerAuthorityService,
    PaymentRefundLedgerAuthorityService,
    LedgerCommandBus,
  ]
})
export class FinanceLedgerModule {}
