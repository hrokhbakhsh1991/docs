import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { ToursController } from "./tours.controller";
import { TourEntity } from "./entities/tour.entity";
import { ToursService } from "./tours.service";

@Module({
  imports: [TypeOrmModule.forFeature([TourEntity]), AuthModule],
  controllers: [ToursController],
  providers: [ToursService]
})
export class ToursModule {}
