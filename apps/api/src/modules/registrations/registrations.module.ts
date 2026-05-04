import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { RegistrationEntity } from "./registration.entity";
import { RegistrationsController } from "./registrations.controller";
import { RegistrationsService } from "./registrations.service";
import { WaitlistItemEntity } from "./waitlist-item.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { UserEntity } from "../identity/entities/user.entity";
import { OutboxModule } from "../outbox/outbox.module";
import { PaymentsModule } from "../payments/payments.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { ThrottlerGuard } from "@nestjs/throttler";

@Module({
  imports: [
    TypeOrmModule.forFeature([RegistrationEntity, WaitlistItemEntity, TourEntity, UserEntity]),
    AuthModule,
    OutboxModule,
    // DI-DIAGNOSTIC: Circular dependency edge with PaymentsModule relies on forwardRef; if combined with weak runtime metadata, provider resolution may degrade into undefined injections.
    // TODO(FREEZE-BLOCKER): Confirm forwardRef cycle with PaymentsModule does not produce partially-initialized providers in E2E runtime container.
    forwardRef(() => PaymentsModule),
    IdempotencyModule
  ],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, ThrottlerGuard],
  exports: [RegistrationsService]
})
export class RegistrationsModule {}
