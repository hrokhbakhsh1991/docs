/**
 * WALLET-V1 — seed default Denali club + pilot tenants for closure E2E.
 */
import { seedDenaliDefaultWallet } from "./seed-denali-default-wallet";
import { seedDenaliWalletPilot } from "./seed-denali-wallet-pilot";
import { ensureAppTourCanReadMigrationHead } from "./seed-wallet-ws1-certification";
import { ProvisioningService } from "../src/internal/provisioning.service";
import { seedOperatorSmokeIdentity } from "./seed-operator-smoke-identity-staging";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error("DENALI_WALLET_V1_REQUIRES_DATABASE_URL");
  }
  process.env.STORAGE_DRIVER = "prisma";
  await ensureAppTourCanReadMigrationHead();
  await seedDenaliDefaultWallet();
  await seedDenaliWalletPilot();
  const provisioning = new ProvisioningService();
  await provisioning.seedOperatorSmokeTenant();
  await seedOperatorSmokeIdentity();
  console.log("seed-denali-wallet-v1: default + pilot + operator-smoke complete");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
