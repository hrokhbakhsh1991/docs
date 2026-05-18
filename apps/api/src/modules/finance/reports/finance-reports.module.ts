import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxEventEntity } from "../../../common/outbox/entities/outbox-event.entity";
import { ConfigModule } from "../../../config/config.module";
import { DatabaseModule } from "../../../database/database.module";
import { RedisInfraModule } from "../../../infra/redis/redis.module";
import { PaymentReceiptEntity } from "../../payments/entities/payment-receipt.entity";
import { PaymentEntity } from "../../payments/entities/payment.entity";
import { FinanceReportsController } from "./finance-reports.controller";
import { FinanceReportsService } from "./finance-reports.service";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisInfraModule,
    TypeOrmModule.forFeature([PaymentEntity, PaymentReceiptEntity, OutboxEventEntity])
  ],
  controllers: [FinanceReportsController],
  providers: [FinanceReportsService],
  exports: [FinanceReportsService]
})
export class FinanceReportsModule {}
