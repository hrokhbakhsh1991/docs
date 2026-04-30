import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { RegistrationEntity } from "./registration.entity";
import { RegistrationsController } from "./registrations.controller";
import { RegistrationsService } from "./registrations.service";
import { WaitlistItemEntity } from "./waitlist-item.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { OutboxModule } from "../outbox/outbox.module";
import { PaymentsModule } from "../payments/payments.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([RegistrationEntity, WaitlistItemEntity, TourEntity]),
    AuthModule,
    OutboxModule,
    forwardRef(() => PaymentsModule),
    IdempotencyModule
  ],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService]
})
export class RegistrationsModule {}
