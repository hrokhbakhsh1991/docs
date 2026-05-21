import assert from "node:assert/strict";
import test from "node:test";

import { InternalServerErrorException } from "@nestjs/common";

import { TourEntity, TourLifecycleStatus } from "./entities/tour.entity";
import { ToursService } from "./tours.service";

function catalogSyncService(): ToursService {
  return Object.create(ToursService.prototype) as ToursService;
}

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

test("syncProductDepartureForTourWithRepos throws when tour_products row is missing", async () => {
  const svc = catalogSyncService();
  const tour = tourWithCatalogIds();
  const writeRepos = {
    tour: { save: async () => tour },
    tourProduct: {
      findOne: async () => null,
      save: async () => ({}),
      create: () => ({}),
    },
    tourDeparture: {
      findOne: async () => null,
      save: async () => ({}),
      create: () => ({}),
    },
    tourPrice: {
      findOne: async () => null,
      save: async () => ({}),
      create: () => ({}),
    },
  };

  await assert.rejects(
    () =>
      (
        svc as unknown as {
          syncProductDepartureForTourWithRepos: (
            repos: typeof writeRepos,
            t: TourEntity,
          ) => Promise<void>;
        }
      ).syncProductDepartureForTourWithRepos(writeRepos, tour),
    (err: unknown) => {
      assert.ok(err instanceof InternalServerErrorException);
      const body = err.getResponse() as { error?: { code?: string; message?: string } };
      assert.equal(body.error?.code, "CATALOG_SYNC_INTEGRITY_BROKEN");
      assert.match(body.error?.message ?? "", /tour_products/);
      return true;
    },
  );
});

test("syncProductDepartureForTourWithRepos throws when tour_departures row is missing", async () => {
  const svc = catalogSyncService();
  const tour = tourWithCatalogIds();
  const writeRepos = {
    tour: { save: async () => tour },
    tourProduct: {
      findOne: async () => ({ id: tour.tourProductId, title: tour.title }),
      save: async () => ({}),
      create: () => ({}),
    },
    tourDeparture: {
      findOne: async () => null,
      save: async () => ({}),
      create: () => ({}),
    },
    tourPrice: {
      findOne: async () => null,
      save: async () => ({}),
      create: () => ({}),
    },
  };

  await assert.rejects(
    () =>
      (
        svc as unknown as {
          syncProductDepartureForTourWithRepos: (
            repos: typeof writeRepos,
            t: TourEntity,
          ) => Promise<void>;
        }
      ).syncProductDepartureForTourWithRepos(writeRepos, tour),
    (err: unknown) => {
      assert.ok(err instanceof InternalServerErrorException);
      const body = err.getResponse() as { error?: { code?: string; message?: string } };
      assert.equal(body.error?.code, "CATALOG_SYNC_INTEGRITY_BROKEN");
      assert.match(body.error?.message ?? "", /tour_departures/);
      return true;
    },
  );
});
