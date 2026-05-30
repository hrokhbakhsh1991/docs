import assert from "node:assert/strict";
import test from "node:test";

import { InternalServerErrorException } from "@nestjs/common";

import { TourDepartureEntity } from "./entities/tour-departure.entity";
import { TourEntity, TourLifecycleStatus } from "./entities/tour.entity";
import { TourProductEntity } from "./entities/tour-product.entity";
import { TypeOrmToursWriteRepository } from "./repositories/typeorm-tours-write.repository";

function tourWithCatalogIds(): TourEntity {
  const tour = new TourEntity();
  tour.id = "00000000-0000-4000-8000-000000000099";
  tour.tenantId = "00000000-0000-4000-8000-000000000001";
  tour.title = "Catalog sync probe";
  tour.totalCapacity = 10;
  tour.acceptedCount = 0;
  tour.lifecycleStatus = TourLifecycleStatus.DRAFT;
  tour.tourProductId = "00000000-0000-4000-8000-0000000000aa";
  tour.tourDepartureId = tour.id;
  return tour;
}

function writeRepository(): TypeOrmToursWriteRepository {
  return Object.create(TypeOrmToursWriteRepository.prototype) as TypeOrmToursWriteRepository;
}

test("syncProductDepartureForTour throws when tour_products row is missing", async () => {
  const repo = writeRepository();
  const tour = tourWithCatalogIds();
  const manager = {
    getRepository(entity: unknown) {
      if (entity === TourEntity) {
        return { save: async () => tour };
      }
      if (entity === TourProductEntity) {
        return {
          findOne: async () => null,
          save: async () => ({}),
          create: () => ({}),
        };
      }
      return {
        findOne: async () => null,
        save: async () => ({}),
        create: () => ({}),
      };
    },
  };
  (repo as unknown as { tourRepository: { manager: typeof manager } }).tourRepository = {
    manager,
  };

  await assert.rejects(
    () => repo.syncProductDepartureForTour(tour),
    (err: unknown) => {
      assert.ok(err instanceof InternalServerErrorException);
      const body = err.getResponse() as { error?: { code?: string; message?: string } };
      assert.equal(body.error?.code, "CATALOG_SYNC_INTEGRITY_BROKEN");
      assert.match(body.error?.message ?? "", /tour_products/);
      return true;
    },
  );
});

test("syncProductDepartureForTour throws when tour_departures row is missing", async () => {
  const repo = writeRepository();
  const tour = tourWithCatalogIds();
  const manager = {
    getRepository(entity: unknown) {
      if (entity === TourEntity) {
        return { save: async () => tour };
      }
      if (entity === TourProductEntity) {
        return {
          findOne: async () => ({ id: tour.tourProductId, title: tour.title }),
          save: async () => ({}),
          create: () => ({}),
        };
      }
      if (entity === TourDepartureEntity) {
        return {
          findOne: async () => null,
          save: async () => ({}),
          create: () => ({}),
        };
      }
      return {
        findOne: async () => null,
        save: async () => ({}),
        create: () => ({}),
      };
    },
  };
  (repo as unknown as { tourRepository: { manager: typeof manager } }).tourRepository = {
    manager,
  };

  await assert.rejects(
    () => repo.syncProductDepartureForTour(tour),
    (err: unknown) => {
      assert.ok(err instanceof InternalServerErrorException);
      const body = err.getResponse() as { error?: { code?: string; message?: string } };
      assert.equal(body.error?.code, "CATALOG_SYNC_INTEGRITY_BROKEN");
      assert.match(body.error?.message ?? "", /tour_departures/);
      return true;
    },
  );
});
