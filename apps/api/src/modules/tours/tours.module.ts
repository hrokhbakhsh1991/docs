import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { ToursController } from "./tours.controller";
import { TourEntity } from "./entities/tour.entity";
import { ToursService } from "./tours.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TourEntity]),
    AuthModule,
    IdempotencyModule,
    RegistrationsModule
  ],
  controllers: [ToursController],
  providers: [ToursService]
})
export class ToursModule {}
