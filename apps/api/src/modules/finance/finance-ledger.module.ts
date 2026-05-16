import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module";
import { BookingLedgerAuthorityService } from "./ledger/booking-ledger-authority.service";
import { PaymentRefundLedgerAuthorityService } from "./ledger/payment-refund-ledger-authority.service";

@Module({
  imports: [OutboxModule],
  providers: [BookingLedgerAuthorityService, PaymentRefundLedgerAuthorityService],
  exports: [BookingLedgerAuthorityService, PaymentRefundLedgerAuthorityService]
})
export class FinanceLedgerModule {}
