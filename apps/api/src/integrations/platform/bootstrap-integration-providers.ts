import { isIntegrationSubsystemReady } from "../../health/integration-subsystem-gate";
import { registerIntegrationProvider } from "./integration-provider-registry";
import { createTelegramProviderAdapter } from "../providers/telegram";
import { createMelipayamakSmsProviderAdapter } from "../providers/melipayamak/melipayamak-sms-provider.adapter";

let bootstrapped = false;

/** Registers built-in provider plugins (telegram first). Idempotent. */
export function bootstrapIntegrationProviders(): void {
  if (!isIntegrationSubsystemReady()) {
    return;
  }
  if (bootstrapped) {
    return;
  }
  registerIntegrationProvider(createTelegramProviderAdapter());
  registerIntegrationProvider(createMelipayamakSmsProviderAdapter());
  bootstrapped = true;
}

/** Test-only */
export function resetIntegrationProviderBootstrapForTests(): void {
  bootstrapped = false;
}
