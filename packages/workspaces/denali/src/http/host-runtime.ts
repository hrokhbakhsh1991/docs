import type { DenaliFinanceHttpHostPorts } from "./host-ports";

let configuredPorts: DenaliFinanceHttpHostPorts | null = null;

export function configureDenaliFinanceHttpHost(ports: DenaliFinanceHttpHostPorts): void {
  configuredPorts = ports;
}

export function resetDenaliFinanceHttpHostForTests(): void {
  configuredPorts = null;
}

export function getDenaliFinanceHttpHost(): DenaliFinanceHttpHostPorts {
  if (configuredPorts === null) {
    throw new Error("DENALI_FINANCE_HTTP_HOST_NOT_CONFIGURED");
  }
  return configuredPorts;
}
