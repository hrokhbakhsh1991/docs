import { Module, Global, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { RegistrationEntity } from "./registration.entity";
import { RegistrationsController } from "./registrations.controller";
import { RegistrationQuoteApplicationService } from "./application/registration-quote.application.service";
import { TypeOrmRegistrationsReadRepository } from "./repositories/typeorm-registrations-read.repository";
import { TypeOrmRegistrationsApplicationService } from "./repositories/typeorm-registrations-application.service";
import { REGISTRATIONS_APPLICATION_PORT } from "./domain/ports/registrations-application.port";
import { REGISTRATIONS_READ_REPOSITORY_PORT } from "./domain/ports/registrations-read.port";
import { RegistrationsService } from "./registrations.service";
import { RegistrationPlacementOrchestrator } from "./application/registration-placement.orchestrator";
import { WaitlistItemEntity } from "./waitlist-item.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { UserEntity } from "../identity/entities/user.entity";
import { OutboxModule } from "../outbox/outbox.module";
import { PaymentsModule } from "../payments/payments.module";
import { PricingModule } from "../pricing/pricing.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { FinanceLedgerModule } from "../finance/finance-ledger.module";
import { ThrottlerGuard } from "@nestjs/throttler";
import { REGISTRATION_PAYMENT_PORT } from "./ports/registration-payment.port";
import { REGISTRATION_READ_PORT } from "./domain/ports/registration-read.port";
import { PRICING_CATALOG_PORT } from "./domain/ports/pricing-catalog.port";
import { PaymentsRegistrationReadAdapter } from "./adapters/payments-registration-read.adapter";
import { PricingCatalogAdapter } from "./adapters/pricing-catalog.adapter";
import {
  FinanceReceiptActorAdapter,
  ReconciliationRegistrationReadAdapter,
  RegistrationFinancialMutationAdapter,
} from "./repositories/registration-finance-port.adapters";
import { REGISTRATION_FINANCIAL_MUTATION_PORT } from "../../common/ports/registration-financial-mutation.port";
import { FINANCE_RECEIPT_ACTOR_PORT } from "../../common/ports/finance-receipt-actor.port";
import { RECONCILIATION_REGISTRATION_READ_PORT } from "../../common/ports/reconciliation-registration-read.port";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegistrationEntity,
      WaitlistItemEntity,
      TourEntity,
      TourDepartureEntity,
      UserEntity
    ]),
    AuthModule,
    OutboxModule,
    forwardRef(() => PaymentsModule),
    PricingModule,
    IdempotencyModule,
    FinanceLedgerModule
  ],
  controllers: [RegistrationsController],
  providers: [
    TypeOrmRegistrationsReadRepository,
    {
      provide: REGISTRATIONS_READ_REPOSITORY_PORT,
      useClass: TypeOrmRegistrationsReadRepository,
    },
    TypeOrmRegistrationsApplicationService,
    {
      provide: REGISTRATIONS_APPLICATION_PORT,
      useExisting: TypeOrmRegistrationsApplicationService,
    },
    RegistrationQuoteApplicationService,
    RegistrationsService,
    RegistrationPlacementOrchestrator,
    {
      provide: REGISTRATION_PAYMENT_PORT,
      useExisting: RegistrationsService
    },
    {
      provide: REGISTRATION_READ_PORT,
      useClass: PaymentsRegistrationReadAdapter
    },
    {
      provide: PRICING_CATALOG_PORT,
      useClass: PricingCatalogAdapter
    },
    RegistrationFinancialMutationAdapter,
    {
      provide: REGISTRATION_FINANCIAL_MUTATION_PORT,
      useClass: RegistrationFinancialMutationAdapter,
    },
    FinanceReceiptActorAdapter,
    {
      provide: FINANCE_RECEIPT_ACTOR_PORT,
      useClass: FinanceReceiptActorAdapter,
    },
    ReconciliationRegistrationReadAdapter,
    {
      provide: RECONCILIATION_REGISTRATION_READ_PORT,
      useClass: ReconciliationRegistrationReadAdapter,
    },
    ThrottlerGuard
  ],
  exports: [
    RegistrationsService,
    REGISTRATION_PAYMENT_PORT,
    REGISTRATION_FINANCIAL_MUTATION_PORT,
    FINANCE_RECEIPT_ACTOR_PORT,
    RECONCILIATION_REGISTRATION_READ_PORT,
  ]
})
export class RegistrationsModule {}
