import assert from "node:assert/strict";
import test from "node:test";
import {
  RegistrationEntryModeDto,
  RegistrationTransportModeDto
} from "../../src/modules/registrations/dto/create-registration.dto";
import { RegistrationStatus } from "../../src/modules/registrations/registration.entity";
import { RegistrationsController } from "../../src/modules/registrations/registrations.controller";

test("public register returns paymentIntent when requiresPayment=true", async () => {
  const controller = new RegistrationsController(
    {
      async createPublicRegistrationOrWaitlist() {
        return {
          type: "registration" as const,
          requiresPayment: true,
          registration: {
            id: "reg-1",
            tenantId: "tenant-1",
            tourId: "tour-1",
            participantFullName: "A",
            participantContactPhone: "+1",
            transportMode: "group_vehicle",
            entryMode: "web",
            status: RegistrationStatus.ACCEPTED,
            paymentStatus: "NotPaid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
      }
    } as never,
    {
      async publicRegister() {
        return {
          registration: { id: "reg-1" } as any,
          paymentIntent: { id: "pay-1", status: "Pending" } as any,
          waitlistItemId: null,
          waitlistPosition: null
        };
      }
    } as never,
    {
      createRequestHash: () => "hash-1",
      async executeWithIdempotency(params: any, handler: any) {
        const res = await handler();
        return { statusCode: params.statusCode ?? 201, responseBody: res, replayed: false };
      }
    } as never,
    {
      setTenantId: () => {},
      setTenantEnabledModules: () => {},
      resolveEffectiveTenantId: () => "tenant-1",
      getTenantId: () => "tenant-1"
    } as never,
    {
      async resolvePublicTourBootstrapContext() {
        return { tenantId: "tenant-1", enabledModules: [] };
      },
      async resolveTenantFromTourId() {
        return "tenant-1";
      }
    } as never
  );

  const response = await controller.publicRegister("tour-1" as never, {
    tourId: "tour-1",
    participantFullName: "A",
    participantContactPhone: "+1",
    transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
    entryMode: RegistrationEntryModeDto.WEB
  }, "test-idempotency-key");

  assert.equal(response.registration !== null, true);
  assert.equal(response.paymentIntent !== null, true);
});

test("public register returns waitlist position when capacity full", async () => {
  const controller = new RegistrationsController(
    {
      async createPublicRegistrationOrWaitlist() {
        return {
          type: "waitlist" as const,
          waitlistItem: { id: "w-1" },
          queuePosition: 2
        };
      }
    } as never,
    {
      async publicRegister() {
        return {
          registration: null,
          paymentIntent: null,
          waitlistItemId: "w-1",
          waitlistPosition: 2
        };
      }
    } as never,
    {
      createRequestHash: () => "hash-1",
      async executeWithIdempotency(params: any, handler: any) {
        const res = await handler();
        return { statusCode: params.statusCode ?? 201, responseBody: res, replayed: false };
      }
    } as never,
    {
      setTenantId: () => {},
      setTenantEnabledModules: () => {},
      resolveEffectiveTenantId: () => "tenant-1",
      getTenantId: () => "tenant-1"
    } as never,
    {
      async resolvePublicTourBootstrapContext() {
        return { tenantId: "tenant-1", enabledModules: [] };
      },
      async resolveTenantFromTourId() {
        return "tenant-1";
      }
    } as never
  );

  const response = await controller.publicRegister("tour-1" as never, {
    tourId: "tour-1",
    participantFullName: "A",
    participantContactPhone: "+1",
    transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
    entryMode: RegistrationEntryModeDto.WEB
  }, "test-idempotency-key");

  assert.equal(response.registration, null);
  assert.equal(response.waitlistPosition, 2);
});
