/**
 * Read-only tour catalog wiring (repository port only).
 * Extracted so Payments and other modules can use {@link TOURS_CATALOG_REPOSITORY_PORT}
 * without importing {@link ToursModule} (avoids payments → tours → registrations → payments cycle).
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { TourDetails } from "./entities/tour-details.entity";
import { TourEntity } from "./entities/tour.entity";
import { TourDepartureEntity } from "./entities/tour-departure.entity";
import { TourPriceEntity } from "./entities/tour-price.entity";
import { TourProductEntity } from "./entities/tour-product.entity";
import { TOURS_CATALOG_REPOSITORY_PORT } from "./domain/ports/tours-repository.port";
import { TypeOrmToursCatalogRepository } from "./repositories/typeorm-tours-catalog.repository";

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      TourEntity,
      TourDetails,
      TourProductEntity,
      TourDepartureEntity,
      TourPriceEntity,
    ]),
  ],
  providers: [
    {
      provide: TOURS_CATALOG_REPOSITORY_PORT,
      useClass: TypeOrmToursCatalogRepository,
    },
  ],
  exports: [TOURS_CATALOG_REPOSITORY_PORT],
})
export class ToursCatalogModule {}
