import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@repo/shared-rbac";
import type { EntityManager } from "typeorm";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { TourEntity, TourLifecycleStatus } from "../tours/entities/tour.entity";
import { TourPriceEntity, TourPriceType } from "../tours/entities/tour-price.entity";
import { PricingEngineService } from "./pricing-engine.service";

function mockManager(handlers: {
  tour?: TourEntity | null;
  departure?: TourDepartureEntity | null;
  prices?: TourPriceEntity[];
}): EntityManager {
  return {
    getRepository(entity: unknown) {
      if (entity === TourEntity) {
        return {
          async findOne() {
            return handlers.tour ?? null;
          }
        };
      }
      if (entity === TourDepartureEntity) {
        return {
          async findOne() {
            return handlers.departure ?? null;
          }
        };
      }
      if (entity === TourPriceEntity) {
        return {
          async find() {
            return handlers.prices ?? [];
          }
        };
      }
      throw new Error("unexpected entity in mockManager");
    }
  } as unknown as EntityManager;
}

const tenantId = "11111111-1111-4111-8111-111111111111";
const tourId = "22222222-2222-4222-8222-222222222222";
const departureId = "22222222-2222-4222-8222-222222222222";

const baseTour = {
  id: tourId,
  tenantId,
  tourDepartureId: departureId,
  tourProductId: "33333333-3333-4333-8333-333333333333",
  title: "T",
  totalCapacity: 10,
  acceptedCount: 0,
  lifecycleStatus: TourLifecycleStatus.OPEN,
  transportModes: [],
  costContext: { totalCost: 100, currency: "usd" }
} as unknown as TourEntity;

const baseDeparture: TourDepartureEntity = {
  id: departureId,
  tenantId,
  tourProductId: "33333333-3333-4333-8333-333333333333",
  capacityTotal: 10,
  reservedCount: 0,
  soldCount: 0,
  lifecycleStatus: TourLifecycleStatus.OPEN,
  listPriceMinor: null,
  currencyCode: null
} as TourDepartureEntity;

test("PricingEngine: BASE row drives list price", async () => {
  const engine = new PricingEngineService();
  const prices: TourPriceEntity[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tourDepartureId: departureId,
      priceType: TourPriceType.BASE,
      currencyCode: "USD",
      amountMinor: "9999",
      conditionsJson: null,
      createdAt: new Date()
    } as TourPriceEntity
  ];
  const q = await engine.quote(
    mockManager({ tour: baseTour, departure: baseDeparture, prices }),
    {
      tenantId,
      tourId,
      departureId,
      userRole: WorkspaceRole.Member,
      discountCode: null
    }
  );
  assert.equal(q.line_items[0].amount_minor, "9999");
  assert.equal(q.total, "9999");
  assert.match(q.pricing_version, /^fp-shadow-0\.1\.0:[a-f0-9]{16}$/);
  assert.equal(q.pricing_rule_version, q.pricing_version);
});

test("PricingEngine: PCT10 promo reduces total", async () => {
  const engine = new PricingEngineService();
  const prices: TourPriceEntity[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tourDepartureId: departureId,
      priceType: TourPriceType.BASE,
      currencyCode: "USD",
      amountMinor: "10000",
      conditionsJson: null,
      createdAt: new Date()
    } as TourPriceEntity
  ];
  const q = await engine.quote(
    mockManager({ tour: baseTour, departure: baseDeparture, prices }),
    {
      tenantId,
      tourId,
      departureId,
      userRole: WorkspaceRole.Member,
      discountCode: "PCT10"
    }
  );
  assert.equal(q.total, "9000");
});

test("PricingEngine: staff role adds workspace adjustment", async () => {
  const engine = new PricingEngineService();
  const prices: TourPriceEntity[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tourDepartureId: departureId,
      priceType: TourPriceType.BASE,
      currencyCode: "USD",
      amountMinor: "10000",
      conditionsJson: null,
      createdAt: new Date()
    } as TourPriceEntity
  ];
  const q = await engine.quote(
    mockManager({ tour: baseTour, departure: baseDeparture, prices }),
    {
      tenantId,
      tourId,
      departureId,
      userRole: WorkspaceRole.Owner,
      discountCode: null
    }
  );
  assert.equal(q.total, "9700");
});

test("PricingEngine: tour/departure mismatch is 400", async () => {
  const engine = new PricingEngineService();
  const badDeparture = { ...baseDeparture, id: "44444444-4444-4444-8444-444444444444" };
  await assert.rejects(
    () =>
      engine.quote(mockManager({ tour: baseTour, departure: badDeparture, prices: [] }), {
        tenantId,
        tourId,
        departureId: badDeparture.id,
        userRole: WorkspaceRole.Member,
        discountCode: null
      }),
    (e) => e instanceof BadRequestException
  );
});

test("PricingEngine: identical quote when invoked twice on same catalog rows", async () => {
  const engine = new PricingEngineService();
  const prices: TourPriceEntity[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tourDepartureId: departureId,
      priceType: TourPriceType.BASE,
      currencyCode: "USD",
      amountMinor: "10000",
      conditionsJson: null,
      createdAt: new Date()
    } as TourPriceEntity
  ];
  const mgr = mockManager({ tour: baseTour, departure: baseDeparture, prices });
  const input = {
    tenantId,
    tourId,
    departureId,
    userRole: WorkspaceRole.Member,
    discountCode: null
  };
  const q1 = await engine.quote(mgr, input);
  const q2 = await engine.quote(mgr, input);
  assert.deepEqual(q1, q2);
});

test("PricingEngine: unknown tour is 404", async () => {
  const engine = new PricingEngineService();
  await assert.rejects(
    () =>
      engine.quote(mockManager({ tour: null, departure: baseDeparture, prices: [] }), {
        tenantId,
        tourId,
        departureId,
        userRole: WorkspaceRole.Member,
        discountCode: null
      }),
    (e) => e instanceof NotFoundException
  );
});
