import { Module, Global, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { RegistrationEntity } from "./registration.entity";
import { RegistrationsController } from "./registrations.controller";
import { RegistrationQuoteApplicationService } from "./application/registration-quote.application.service";
import { RegistrationsReadRepository } from "./repositories/registrations-read.repository";
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
    RegistrationsReadRepository,
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
    ThrottlerGuard
  ],
  exports: [RegistrationsService, REGISTRATION_PAYMENT_PORT]
})
export class RegistrationsModule {}
