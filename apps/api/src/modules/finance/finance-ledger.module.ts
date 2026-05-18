import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module";
import { BookingLedgerAuthorityService } from "./ledger/booking-ledger-authority.service";
import { PaymentCaptureLedgerAuthorityService } from "./ledger/payment-capture-ledger-authority.service";
import { PaymentRefundLedgerAuthorityService } from "./ledger/payment-refund-ledger-authority.service";

@Module({
  imports: [OutboxModule],
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
