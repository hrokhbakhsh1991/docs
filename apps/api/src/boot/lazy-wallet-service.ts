import type { WalletServicePort } from "@app-tour/wallet-http";
import type { WalletCapabilityPort } from "@app-tour/workspace-sdk/wallet";

import { HostWalletCapabilityAdapter } from "../workspace-wallet/infrastructure/host-wallet-capability.adapter";
import { createWalletRepository } from "../workspace-wallet/wallet-repository.factory";
import { createWalletService, type WalletService } from "../workspace-wallet/wallet.service";

let sharedCapability: WalletCapabilityPort | null = null;
let walletServiceSingleton: WalletService | null = null;

function getSharedCapability(): WalletCapabilityPort {
  if (sharedCapability === null) {
    sharedCapability = new HostWalletCapabilityAdapter();
  }
  return sharedCapability as WalletCapabilityPort;
}

export function resetLazyWalletServiceForTests(): void {
  walletServiceSingleton = null;
  sharedCapability = null;
}

export function resolveWalletService(injected?: WalletServicePort): WalletServicePort {
  if (injected !== undefined) {
    return injected;
  }
  if (walletServiceSingleton === null) {
    walletServiceSingleton = createWalletService({
      repository: createWalletRepository(),
      capability: getSharedCapability(),
    });
  }
  return walletServiceSingleton;
}

export async function resolveWalletServiceForTenant(
  tenantId: string,
  injected?: WalletServicePort,
): Promise<WalletServicePort> {
  if (injected !== undefined) {
    return injected;
  }
  const service = resolveWalletService();
  await getSharedCapability().assertEnabled(tenantId);
  return service;
}
