import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { DashboardAggregateController } from "./dashboard-aggregate.controller";
import { ToursController } from "./tours.controller";
import { TourDetails } from "./entities/tour-details.entity";
import { TourEntity } from "./entities/tour.entity";
import { ToursService } from "./tours.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TourEntity, TourDetails]),
    AuthModule,
    IdempotencyModule,
    RegistrationsModule
  ],
  controllers: [ToursController, DashboardAggregateController],
  providers: [ToursService]
})
export class ToursModule {}
