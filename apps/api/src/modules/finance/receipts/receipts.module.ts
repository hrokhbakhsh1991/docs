import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../../database/database.module";
import { StorageModule } from "../../../infra/storage/storage.module";
import { FinanceLedgerModule } from "../finance-ledger.module";
import { FinanceReportsModule } from "../reports/finance-reports.module";
import { ReceiptService } from "./receipt.service";
import { PaymentReceiptEntity } from "../../payments/entities/payment-receipt.entity";
import { PaymentEntity } from "../../payments/entities/payment.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentReceiptEntity, PaymentEntity]),
    DatabaseModule,
    StorageModule,
    FinanceLedgerModule,
    FinanceReportsModule
  ],
  providers: [ReceiptService],
  exports: [ReceiptService]
})
export class ReceiptsModule {}
