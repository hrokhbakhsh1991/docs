/**
 * TypeORM adapter for {@link ToursWriteRepositoryPort}.
 * Sole tours-module site for `@InjectRepository` / `typeorm` on tour write paths.
 */
import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial, EntityManager } from "typeorm";
import { DataSource, Repository } from "typeorm";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { getIdempotentEntityManager } from "../../idempotency/idempotent-transaction.context";
import { TOUR_RESPONSE_RELATIONS } from "../constants/tour-response-relations";
import type { ToursWriteRepositoryPort } from "../domain/ports/tours-repository.port";
import { TourDepartureEntity } from "../entities/tour-departure.entity";
import { TourEntity } from "../entities/tour.entity";
import { TourPriceEntity, TourPriceType } from "../entities/tour-price.entity";
import { TourProductEntity } from "../entities/tour-product.entity";
import {
  currencyCodeFromCostContext,
  extractTripLogisticsDates,
  listPriceMinorFromCostContext
} from "../utils/commercial-fields";

@Injectable()
export class TypeOrmToursWriteRepository implements ToursWriteRepositoryPort {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  getIdempotentManager(): EntityManager | null {
    return getIdempotentEntityManager() ?? null;
  }

  getDefaultManager(): EntityManager {
    return this.tourRepository.manager;
  }

  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(fn);
  }

  createTourEntity(manager: EntityManager, data: DeepPartial<TourEntity>): TourEntity {
    return manager.getRepository(TourEntity).create(data);
  }

  async createTour(manager: EntityManager, tour: TourEntity, tenantId: string): Promise<TourEntity> {
    const saved = await manager.getRepository(TourEntity).save(tour);
    const loaded = await this.findTourWithRelations(manager, tenantId, saved.id);
    if (!loaded) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    await this.syncProductDepartureForTour(manager, loaded);
    return loaded;
  }

  loadTourForUpdateLocking(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourEntity | null> {
    return manager
      .getRepository(TourEntity)
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.details", "details")
      .leftJoinAndSelect("t.destination", "destination")
      .leftJoinAndSelect("destination.region", "destinationRegion")
      .where("t.id = :tourId", { tourId })
      .andWhere("t.tenantId = :tenantId", { tenantId })
      .setLock("pessimistic_write", undefined, ["t"])
      .getOne();
  }

  async updateTour(manager: EntityManager, tour: TourEntity, tenantId: string): Promise<TourEntity> {
    const saved = await manager.getRepository(TourEntity).save(tour);
    const reloaded = await this.findTourWithRelations(manager, tenantId, saved.id);
    if (!reloaded) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    await this.syncProductDepartureForTour(manager, reloaded);
    return reloaded;
  }

  async syncProductDepartureForTour(manager: EntityManager, tour: TourEntity): Promise<void> {
    const tourRepo = manager.getRepository(TourEntity);
    const tourProductRepo = manager.getRepository(TourProductEntity);
    const tourDepartureRepo = manager.getRepository(TourDepartureEntity);
    const tourPriceRepo = manager.getRepository(TourPriceEntity);

    const { startsOn, endsOn } = extractTripLogisticsDates(tour.details ?? null);
    const currency = currencyCodeFromCostContext(tour.costContext);
    const listMinor = listPriceMinorFromCostContext(tour.costContext);

    if (!tour.tourProductId) {
      const product = tourProductRepo.create({
        tenantId: tour.tenantId,
        title: tour.title,
        description: tour.description ?? null
      });
      await tourProductRepo.save(product);

      const departure = tourDepartureRepo.create({
        id: tour.id,
        tourProductId: product.id,
        tenantId: tour.tenantId,
        startsOn: startsOn ?? undefined,
        endsOn: endsOn ?? undefined,
        currencyCode: currency,
        listPriceMinor: listMinor ?? undefined,
        lifecycleStatus: tour.lifecycleStatus,
        capacityTotal: tour.totalCapacity,
        reservedCount: 0,
        soldCount: tour.acceptedCount
      });
      await tourDepartureRepo.save(departure);

      tour.tourProductId = product.id;
      tour.tourDepartureId = tour.id;
      await tourRepo.save(tour);

      const price = tourPriceRepo.create({
        tourDepartureId: departure.id,
        priceType: TourPriceType.BASE,
        currencyCode: currency,
        amountMinor: listMinor ?? "0"
      });
      await tourPriceRepo.save(price);
      return;
    }

    const product = await tourProductRepo.findOne({
      where: { id: tour.tourProductId }
    });
    if (!product) {
      this.throwCatalogSyncIntegrityBroken("tour_products row missing for tour.tourProductId");
    }
    product.title = tour.title;
    product.description = tour.description ?? null;
    await tourProductRepo.save(product);

    const departureId = tour.tourDepartureId ?? tour.id;
    const dep = await tourDepartureRepo.findOne({ where: { id: departureId } });
    if (!dep) {
      this.throwCatalogSyncIntegrityBroken("tour_departures row missing for tour.tourDepartureId");
    }
    dep.startsOn = startsOn ?? undefined;
    dep.endsOn = endsOn ?? undefined;
    dep.currencyCode = currency;
    dep.listPriceMinor = listMinor ?? undefined;
    dep.lifecycleStatus = tour.lifecycleStatus;
    dep.capacityTotal = tour.totalCapacity;
    dep.soldCount = tour.acceptedCount;
    await tourDepartureRepo.save(dep);

    const basePrice = await tourPriceRepo.findOne({
      where: { tourDepartureId: dep.id, priceType: TourPriceType.BASE }
    });
    if (basePrice) {
      basePrice.currencyCode = currency;
      basePrice.amountMinor = listMinor ?? basePrice.amountMinor;
      await tourPriceRepo.save(basePrice);
    }
  }

  private async findTourWithRelations(
    manager: EntityManager,
    tenantId: string,
    tourId: string
  ): Promise<TourEntity | null> {
    return manager.getRepository(TourEntity).findOne({
      where: { id: tourId, tenantId },
      relations: TOUR_RESPONSE_RELATIONS
    });
  }

  private throwCatalogSyncIntegrityBroken(message: string): never {
    throw new InternalServerErrorException({
      error: {
        code: "CATALOG_SYNC_INTEGRITY_BROKEN",
        message
      }
    });
  }
}
