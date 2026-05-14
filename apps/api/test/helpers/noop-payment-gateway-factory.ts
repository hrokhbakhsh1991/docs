import type { PaymentGatewayFactory } from "../../src/modules/payments/gateway/payment-gateway.factory";

/** Use in unit tests that never call `createPaymentIntent`. */
export const noopPaymentGatewayFactoryForTests = {
  forProvider() {
    return {
      providerId: "noop",
      async createPaymentIntent() {
        throw new Error("payment gateway should not be invoked in this test");
      }
    };
  }
} as unknown as PaymentGatewayFactory;

/** Minimal stub for tests that exercise `createPaymentIntent` without network. */
export const stubPaymentGatewayFactoryForTests = {
  forProvider() {
    return {
      providerId: "stub",
      async createPaymentIntent(input: { registrationId: string }) {
        const suffix = input.registrationId.replace(/-/g, "").slice(0, 12);
        return {
          provider: "stub",
          providerPaymentId: `stub_pi_${suffix}`,
          clientSecret: `stub_cs_${suffix}`,
          status: "requires_payment_method" as const
        };
      }
    };
  }
} as unknown as PaymentGatewayFactory;
