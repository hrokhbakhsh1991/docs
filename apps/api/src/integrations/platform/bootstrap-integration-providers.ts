import { isIntegrationSubsystemReady } from "../../health/integration-subsystem-gate";
import { registerIntegrationProvider } from "./integration-provider-registry";
import { createTelegramProviderAdapter } from "../providers/telegram";

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
  bootstrapped = true;
}

/** Test-only */
export function resetIntegrationProviderBootstrapForTests(): void {
  bootstrapped = false;
}
