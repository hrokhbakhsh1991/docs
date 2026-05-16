import { Injectable, NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { TourDepartureEntity } from "../entities/tour-departure.entity";
import { TourEntity } from "../entities/tour.entity";
import { TourPriceEntity } from "../entities/tour-price.entity";
import type { CatalogPricingLoadPort } from "../../finance/pricing/ports/catalog-pricing-load.port";
import type { CatalogPricingSnapshot } from "../../finance/pricing/contracts/catalog-pricing-snapshot.dto";
import type { PricingContext } from "../../finance/pricing/pricing-context";
import { quoteListPriceForTour } from "./quote-list-price";

/**
 * Loads {@link CatalogPricingSnapshot} using tour ORM entities.
 * Keeps **all** tour entity access out of `modules/finance`.
 */
@Injectable()
export class CatalogPricingLoadAdapter implements CatalogPricingLoadPort {
  async loadSnapshot(manager: EntityManager, context: PricingContext): Promise<CatalogPricingSnapshot> {
    const tourRepo = manager.getRepository(TourEntity);
    const depRepo = manager.getRepository(TourDepartureEntity);
    const priceRepo = manager.getRepository(TourPriceEntity);

    const tour = await tourRepo.findOne({
      where: { id: context.tourId, tenantId: context.tenantId }
    });
    if (!tour) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour not found in tenant scope" }
      });
    }

    const departure = await depRepo.findOne({
      where: { id: context.departureId, tenantId: context.tenantId }
    });
    if (!departure) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Departure not found in tenant scope" }
      });
    }

    const prices = await priceRepo.find({
      where: { tourDepartureId: departure.id }
    });

    const q = quoteListPriceForTour(tour);

    return {
      tour: {
        id: tour.id,
        tenantId: tour.tenantId,
        tourDepartureId: tour.tourDepartureId ?? null,
        tourProductId: tour.tourProductId ?? null,
        listPriceMinor: tour.listPriceMinor ?? null,
        currencyCode: tour.currencyCode ?? null,
        quoteListFallbackMinor: q.listPriceMinor ?? null,
        quoteListFallbackCurrency: q.currencyCode
      },
      departure: {
        id: departure.id,
        tenantId: departure.tenantId,
        tourProductId: departure.tourProductId,
        listPriceMinor: departure.listPriceMinor ?? null,
        currencyCode: departure.currencyCode ?? null
      },
      prices: prices.map((p) => ({
        id: p.id,
        tourDepartureId: p.tourDepartureId,
        priceType: p.priceType,
        amountMinor: p.amountMinor,
        currencyCode: p.currencyCode,
        conditionsJson:
          p.conditionsJson && typeof p.conditionsJson === "object" && !Array.isArray(p.conditionsJson)
            ? (p.conditionsJson as Record<string, unknown>)
            : null
      }))
    };
  }
}
