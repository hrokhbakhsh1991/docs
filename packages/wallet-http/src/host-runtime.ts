import type { WalletHttpHostPorts } from "./host-ports";

let configuredPorts: WalletHttpHostPorts | null = null;

export function configureWalletHttpHost(ports: WalletHttpHostPorts): void {
  configuredPorts = ports;
}

export function resetWalletHttpHostForTests(): void {
  configuredPorts = null;
}

export function getWalletHttpHost(): WalletHttpHostPorts {
  if (configuredPorts === null) {
    throw new Error("WALLET_HTTP_HOST_NOT_CONFIGURED");
  }
  return configuredPorts;
}
