import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { createPricingSnapshot } from "../../src/modules/pricing/repositories/create-pricing-snapshot.repository";
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";
import { RegistrationEntity } from "../../src/modules/registrations/registration.entity";

test("createPricingSnapshot rejects when booking id is not in tenant scope", async () => {
  const manager = {
    async findOne(entity: unknown) {
      if (entity === RegistrationEntity) {
        return null;
      }
      return null;
    },
    create() {
      return {};
    },
    async save() {
      throw new Error("save should not run");
    }
  };

  await assert.rejects(
    () =>
      createPricingSnapshot(manager as never, {
        tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        listPriceMinor: "100",
        currency: "USD",
        pricingRuleVersion: "v1",
        computedTotalMinor: "100"
      }),
    (e) => e instanceof ConflictException
  );
});

test("createPricingSnapshot inserts append-only row when booking matches tenant", async () => {
  let saved: unknown;
  const manager = {
    async findOne(entity: unknown) {
      if (entity === RegistrationEntity) {
        return {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        };
      }
      return null;
    },
    create(_entity: unknown, row: Record<string, unknown>) {
      return row;
    },
    async save(_entity: unknown, row: unknown) {
      saved = row;
      return { ...(row as object), snapshotId: "snap-1" } as BookingPriceSnapshotEntity;
    }
  };

  const out = await createPricingSnapshot(manager as never, {
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    listPriceMinor: "100",
    currency: "usd",
    pricingRuleVersion: "v1",
    computedTotalMinor: "100"
  });
  assert.equal(out.snapshotId, "snap-1");
  assert.equal((saved as { tenantId: string }).tenantId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal((saved as { currency: string }).currency, "USD");
});
