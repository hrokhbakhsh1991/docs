import type { FinanceHttpHostPorts } from "./host-ports";

let configuredPorts: FinanceHttpHostPorts | null = null;

export function configureFinanceHttpHost(ports: FinanceHttpHostPorts): void {
  configuredPorts = ports;
}

export function resetFinanceHttpHostForTests(): void {
  configuredPorts = null;
}

export function getFinanceHttpHost(): FinanceHttpHostPorts {
  if (configuredPorts === null) {
    // Preserve historical error code string for callers/tests.
    throw new Error("DENALI_FINANCE_HTTP_HOST_NOT_CONFIGURED");
  }
  return configuredPorts;
}

/** @deprecated Prefer {@link configureFinanceHttpHost}. */
export const configureDenaliFinanceHttpHost = configureFinanceHttpHost;
/** @deprecated Prefer {@link resetFinanceHttpHostForTests}. */
export const resetDenaliFinanceHttpHostForTests = resetFinanceHttpHostForTests;
/** @deprecated Prefer {@link getFinanceHttpHost}. */
export const getDenaliFinanceHttpHost = getFinanceHttpHost;
