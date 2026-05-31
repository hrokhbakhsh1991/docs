/**
 * TypeORM adapter for {@link ToursWriteRepositoryPort}.
 * Sole tours-module site for `@InjectRepository` / `typeorm` on tour write paths.
 */
import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial, EntityManager } from "typeorm";
import { DataSource, Repository } from "typeorm";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import {
  getIdempotentEntityManager,
  runWithIdempotentEntityManager
} from "../../idempotency/idempotent-transaction.context";
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

  private get activeManager(): EntityManager {
    return getIdempotentEntityManager() ?? this.tourRepository.manager;
  }

  runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const em = getIdempotentEntityManager();
    if (em) {
      return fn();
    }
    return this.dataSource.transaction((manager) => {
      return runWithIdempotentEntityManager(manager, fn);
    });
  }

  createTourEntity(data: DeepPartial<TourEntity>): TourEntity {
    return this.activeManager.getRepository(TourEntity).create(data);
  }

  async createTour(tour: TourEntity, tenantId: string): Promise<TourEntity> {
    const manager = this.activeManager;
    const saved = await manager.getRepository(TourEntity).save(tour);
    const loaded = await this.findTourWithRelations(manager, tenantId, saved.id);
    if (!loaded) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    await this.syncProductDepartureForTour(loaded);
    return loaded;
  }

  loadTourForUpdateLocking(
    tourId: string,
    tenantId: string
  ): Promise<TourEntity | null> {
    return this.activeManager
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

  async updateTour(tour: TourEntity, tenantId: string): Promise<TourEntity> {
    const manager = this.activeManager;
    const saved = await manager.getRepository(TourEntity).save(tour);
    const reloaded = await this.findTourWithRelations(manager, tenantId, saved.id);
    if (!reloaded) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    await this.syncProductDepartureForTour(reloaded);
    return reloaded;
  }

  async syncProductDepartureForTour(tour: TourEntity): Promise<void> {
    const manager = this.activeManager;
    const tourRepo = manager.getRepository(TourEntity);
    const tourProductRepo = manager.getRepository(TourProductEntity);
    const tourDepartureRepo = manager.getRepository(TourDepartureEntity);
    const tourPriceRepo = manager.getRepository(TourPriceEntity);

    const { startsOn, endsOn } = extractTripLogisticsDates(tour.details ?? null);
    const currency = currencyCodeFromCostContext(tour.costContext, {
      tourCurrencyCode: tour.currencyCode,
    });
    const listMinor = listPriceMinorFromCostContext(tour.costContext, { currencyCode: currency });

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
        tenantId: tour.tenantId,
        tourDepartureId: departure.id,
        priceType: TourPriceType.BASE,
        currencyCode: currency,
        amountMinor: listMinor ?? "0"
      });
      await tourPriceRepo.save(price);
      return;
    }

    const product = await tourProductRepo.findOne({
      where: { id: tour.tourProductId, tenantId: tour.tenantId }
    });
    if (!product) {
      this.throwCatalogSyncIntegrityBroken("tour_products row missing for tour.tourProductId");
    }
    product.title = tour.title;
    product.description = tour.description ?? null;
    await tourProductRepo.save(product);

    const departureId = tour.tourDepartureId ?? tour.id;
    const dep = await tourDepartureRepo.findOne({
      where: { id: departureId, tenantId: tour.tenantId }
    });
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
      where: {
        tourDepartureId: dep.id,
        priceType: TourPriceType.BASE,
        tenantId: tour.tenantId
      }
    });
    if (basePrice) {
      basePrice.currencyCode = currency;
      basePrice.amountMinor = listMinor ?? basePrice.amountMinor;
      basePrice.tenantId = tour.tenantId;
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

