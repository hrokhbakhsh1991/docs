import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import {
  RegistrationEntryModeDto,
  RegistrationTransportModeDto
} from "../../src/modules/registrations/dto/create-registration.dto";
import { BookingLedgerAuthorityService } from "../../src/modules/finance/ledger/booking-ledger-authority.service";
import { noopOutboxServiceForTests } from "../helpers/noop-outbox.service";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { stubRegistrationQuoteApplication } from "../registrations/stub-pricing-engine";
import { createNullStandaloneRegistrationsReadTestDouble } from "../registrations/stub-registrations-read-repository";

function sampleCreateDto(): {
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: RegistrationTransportModeDto;
  entryMode: RegistrationEntryModeDto;
} {
  return {
    tourId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    participantFullName: "Test",
    participantContactPhone: "+989121211111",
    transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
    entryMode: RegistrationEntryModeDto.WEB
  };
}

test("member createRegistration returns 404 when JWT tenant differs from tour.tenantId", async () => {
  const dto = sampleCreateDto();
  const lockedTour = {
    id: dto.tourId,
    tenantId: "22222222-2222-4222-8222-222222222222",
    acceptedCount: 0,
    totalCapacity: 5,
    lifecycleStatus: TourLifecycleStatus.OPEN,
    costContext: {}
  } as TourEntity;

  const manager = {
    async findOne(entity: unknown) {
      if ((entity as { name?: string }).name === TourEntity.name) {
        return lockedTour;
      }
      return null;
    },
    getRepository(entity: unknown) {
      if ((entity as { name?: string }).name === TourEntity.name) {
        return {
          createQueryBuilder() {
            return {
              setLock() {
                return this;
              },
              where() {
                return this;
              },
              andWhere() {
                return this;
              },
              async getOne() {
                return lockedTour;
              }
            };
          }
        };
      }
      return {};
    },
    async save(): Promise<void> {},
    create(): Record<string, unknown> {
      return {};
    },
    async find(): Promise<unknown[]> {
      return [];
    },
    async count(): Promise<number> {
      return 0;
    }
  };

  const dataSource = {
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const service = new RegistrationsService(
    {} as never,
    {} as never,
    dataSource as never,
    {} as never,
    {
      getRole: () => "member",
      resolveEffectiveTenantId: () => "11111111-1111-4111-8111-111111111111",
      getTenantId: () => "11111111-1111-4111-8111-111111111111",
      getUserId: () => "33333333-3333-4333-8333-333333333333"
    } as never,
    {} as never,
    stubRegistrationQuoteApplication,
    createNullStandaloneRegistrationsReadTestDouble(),
    new BookingLedgerAuthorityService(noopOutboxServiceForTests),
    {} as never // PricingEngineService stub
  );

  await assert.rejects(
    () => service.createRegistration(dto),
    (err: unknown) => err instanceof NotFoundException
  );
});

test("getTenantIdForTourOrThrow returns tenant from tour row", async () => {
  const tenantBootstrapService = {
    async resolveTenantFromTourId() {
      return "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    }
  };

  const service = new RegistrationsService(
    {} as never,
    {} as never,
    {} as never,
    tenantBootstrapService as never,
    {} as never,
    {} as never,
    stubRegistrationQuoteApplication,
    createNullStandaloneRegistrationsReadTestDouble(),
    new BookingLedgerAuthorityService(noopOutboxServiceForTests),
    {} as never // PricingEngineService stub
  );

  const tenant = await service.getTenantIdForTourOrThrow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(tenant, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
});

test("getTenantIdForTourOrThrow rejects unknown tour id", async () => {
  const tenantBootstrapService = {
    async resolveTenantFromTourId() {
      return null;
    }
  };

  const service = new RegistrationsService(
    {} as never,
    {} as never,
    {} as never,
    tenantBootstrapService as never,
    {} as never,
    {} as never,
    stubRegistrationQuoteApplication,
    createNullStandaloneRegistrationsReadTestDouble(),
    new BookingLedgerAuthorityService(noopOutboxServiceForTests),
    {} as never // PricingEngineService stub
  );

  await assert.rejects(
    () => service.getTenantIdForTourOrThrow("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    (err: unknown) => err instanceof NotFoundException
  );
});
