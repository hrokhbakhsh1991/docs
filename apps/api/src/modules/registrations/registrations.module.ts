import { Module, Global, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CqrsModule } from "@nestjs/cqrs";
import { AuthModule } from "../auth/auth.module";
import { RegistrationEntity } from "./registration.entity";
import { RegistrationsController } from "./registrations.controller";
import { RegistrationQuoteApplicationService } from "./application/registration-quote.application.service";
import { TypeOrmRegistrationsReadRepository } from "./repositories/typeorm-registrations-read.repository";
import { TypeOrmRegistrationsApplicationService } from "./repositories/typeorm-registrations-application.service";
import { REGISTRATIONS_APPLICATION_PORT } from "./domain/ports/registrations-application.port";
import { REGISTRATIONS_READ_REPOSITORY_PORT } from "./domain/ports/registrations-read.port";
import { REGISTRATIONS_WRITE_REPOSITORY_PORT } from "./domain/ports/registrations-write.port";
import { GetRegistrationDetailHandler } from "./queries/get-registration-detail.handler";
import { UpdateRegistrationPaymentHandler } from "./commands/update-registration-payment.handler";
import { TypeOrmRegistrationsWriteRepository } from "./repositories/typeorm-registrations-write.repository";

import { RegistrationsService } from "./registrations.service";
import { RegistrationPlacementOrchestrator } from "./application/registration-placement.orchestrator";
import { WaitlistItemEntity } from "./waitlist-item.entity";
import { UserEntity } from "../identity/entities/user.entity";
import { OutboxModule } from "../outbox/outbox.module";
import { PaymentsModule } from "../payments/payments.module";
import { PricingModule } from "../pricing/pricing.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { ThrottlerGuard } from "@nestjs/throttler";
import { REGISTRATION_PAYMENT_PORT } from "./ports/registration-payment.port";
import { REGISTRATION_READ_PORT } from "./domain/ports/registration-read.port";
import { PRICING_CATALOG_PORT } from "./domain/ports/pricing-catalog.port";
import { PaymentsRegistrationReadAdapter } from "./adapters/payments-registration-read.adapter";
import { PricingCatalogAdapter } from "./adapters/pricing-catalog.adapter";
import { PaymentCapturedListener } from "./listeners/payment-captured.listener";

import { REGISTRATIONS_TOUR_CATALOG_PORT } from "./domain/ports/registrations-tour-catalog.port";
import { RegistrationsTourCatalogAdapter } from "./adapters/registrations-tour-catalog.adapter";
import { TourCapacityModule } from "../tours/tour-capacity.module";
import { RegistrationFinancePortsModule } from "./registration-finance-ports.module";

@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      RegistrationEntity,
      WaitlistItemEntity,
      UserEntity
    ]),
    AuthModule,
    forwardRef(() => OutboxModule),
    forwardRef(() => PaymentsModule),
    TourCapacityModule,
    RegistrationFinancePortsModule,
    PricingModule,
    IdempotencyModule
  ],
  controllers: [RegistrationsController],
  providers: [
    PaymentCapturedListener,
    GetRegistrationDetailHandler,
    TypeOrmRegistrationsReadRepository,

    {
      provide: REGISTRATIONS_READ_REPOSITORY_PORT,
      useClass: TypeOrmRegistrationsReadRepository,
    },
    TypeOrmRegistrationsWriteRepository,
    {
      provide: REGISTRATIONS_WRITE_REPOSITORY_PORT,
      useClass: TypeOrmRegistrationsWriteRepository,
    },
    UpdateRegistrationPaymentHandler,
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
    {
      provide: REGISTRATIONS_TOUR_CATALOG_PORT,
      useClass: RegistrationsTourCatalogAdapter
    },
    ThrottlerGuard
  ],
  exports: [
    RegistrationsService,
    REGISTRATION_PAYMENT_PORT,
    RegistrationFinancePortsModule,
  ]
})
export class RegistrationsModule {}
