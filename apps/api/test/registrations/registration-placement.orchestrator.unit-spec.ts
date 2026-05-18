import assert from "node:assert/strict";
import test from "node:test";
import { RegistrationPlacementOrchestrator } from "../../src/modules/registrations/application/registration-placement.orchestrator";

test("createAuthenticatedBooking returns registration and payment intent", async () => {
  const orchestrator = new RegistrationPlacementOrchestrator(
    {
      resolveAuthenticatedBookingInput: async (tourId: string) => ({
        tourId,
        participantFullName: "Test User",
        participantContactPhone: "+989120000001",
        transportMode: "group_vehicle",
        entryMode: "web"
      }),
      createPublicRegistrationOrWaitlist: async () => ({
        type: "registration" as const,
        registration: { id: "reg-1" },
        requiresPayment: true,
        paymentIntent: { id: "pay-1", status: "Pending" }
      })
    } as never,
    {
      createPaymentIntentWithManager: async () => {
        throw new Error("should use callback path");
      }
    } as never,
    { getDefaultPaymentProvider: () => "mock_provider" } as never
  );

  const result = await orchestrator.createAuthenticatedBooking("tour-1");
  assert.equal(result.registration.id, "reg-1");
  assert.equal(result.paymentIntent?.id, "pay-1");
});
