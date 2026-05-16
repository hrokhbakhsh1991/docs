import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { RegistrationEntity } from "./registration.entity";
import { RegistrationsController } from "./registrations.controller";
import { RegistrationQuoteApplicationService } from "./application/registration-quote.application.service";
import { RegistrationsReadRepository } from "./repositories/registrations-read.repository";
import { RegistrationsService } from "./registrations.service";
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
    ThrottlerGuard
  ],
  exports: [RegistrationsService]
})
export class RegistrationsModule {}
