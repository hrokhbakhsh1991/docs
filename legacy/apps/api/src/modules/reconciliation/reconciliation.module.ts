import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { TenantUsageModule } from "../../common/billing/tenant-usage.module";
import { TenantAbuseModule } from "../../common/tenant-abuse/tenant-abuse.module";
import { IdentityModule } from "../identity/identity.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { ToursModule } from "../tours/tours.module";
import { TourEntity } from "../tours/entities/tour.entity";
import { PaymentEntity } from "../payments/entities/payment.entity";
import { BookingPriceSnapshotEntity } from "../pricing/entities/booking-price-snapshot.entity";
import { RegistrationEntity } from "../registrations/registration.entity";
import { OutboxEventEntity } from "../../common/outbox/entities/outbox-event.entity";
import { ReconciliationFindingEntity } from "../finance/reconciliation/entities/reconciliation-finding.entity";
import { ReconciliationJobEntity } from "../finance/reconciliation/entities/reconciliation-job.entity";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { UserEntity } from "../identity/entities/user.entity";
import {
  LoggingReconciliationJobAlertHooks,
  RECONCILIATION_JOB_ALERT_HOOKS
} from "../finance/reconciliation/reconciliation-job-alert-hooks";
import { PaymentFinanceReconciliationService } from "./payment-finance-reconciliation.service";
import { ReconciliationFindingsController } from "./reconciliation-findings.controller";
import { ReconciliationFindingsService } from "./reconciliation-findings.service";
import { ReconciliationProcessor } from "./reconciliation.processor";
import { ReconciliationService } from "./reconciliation.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      TourEntity,
      PaymentEntity,
      BookingPriceSnapshotEntity,
      RegistrationEntity,
      OutboxEventEntity,
      ReconciliationJobEntity,
      ReconciliationFindingEntity,
      UserEntity
    ]),
    DatabaseModule,
    TenantUsageModule,
    TenantAbuseModule,
    IdentityModule,
    OutboxModule,
    RegistrationsModule,
    ToursModule
  ],
  providers: [
    LoggingReconciliationJobAlertHooks,
    {
      provide: RECONCILIATION_JOB_ALERT_HOOKS,
      useExisting: LoggingReconciliationJobAlertHooks
    },
    ReconciliationFindingsService,
    PaymentFinanceReconciliationService,
    ReconciliationService,
    ReconciliationProcessor
  ],
  controllers: [ReconciliationFindingsController],
  exports: [ReconciliationService]
})
export class ReconciliationModule {}
