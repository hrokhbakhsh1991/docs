import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { TourPriceEntity } from "../tours/entities/tour-price.entity";
import { BookingPriceSnapshotEntity } from "./entities/booking-price-snapshot.entity";
import { PricingEngineService } from "./pricing-engine.service";
import { CATALOG_PRICING_LOAD_PORT } from "../finance/pricing/ports/catalog-pricing-load.port";
import { CatalogPricingLoadAdapter } from "../tours/pricing/catalog-pricing-load.adapter";

@Module({
  imports: [
    TypeOrmModule.forFeature([TourEntity, TourDepartureEntity, TourPriceEntity, BookingPriceSnapshotEntity])
  ],
  providers: [
    CatalogPricingLoadAdapter,
    { provide: CATALOG_PRICING_LOAD_PORT, useExisting: CatalogPricingLoadAdapter },
    PricingEngineService
  ],
  exports: [PricingEngineService]
})
export class PricingModule {}
