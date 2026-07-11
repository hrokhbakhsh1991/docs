import type { IntegrationsPlaneStatus } from "./integrations-plane-status";

export type { IntegrationsPlaneStatus } from "./integrations-plane-status";

export function resolveIntegrationsPlaneStatusFromEnv(
  env: NodeJS.ProcessEnv = process.env
): IntegrationsPlaneStatus {
  return {
    zibalConfigured: Boolean(env.ZIBAL_MERCHANT?.trim()),
    stripeConfigured: Boolean(env.STRIPE_SECRET_KEY?.trim()),
    webhookConfigured: Boolean(env.PAYMENTS_WEBHOOK_SIGNING_SECRET?.trim()),
    gatewayActivationEnabled: env.P5_D_GATEWAY_ACTIVATION_ENABLED?.trim() === "true",
  };
}
