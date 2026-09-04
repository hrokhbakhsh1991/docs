/**
 * WALLET-V1 — seed default Denali club + pilot tenants for closure E2E.
 */
import { seedDenaliDefaultWallet } from "./seed-denali-default-wallet";
import { seedDenaliWalletPilot } from "./seed-denali-wallet-pilot";
import { ensureAppTourCanReadMigrationHead } from "./seed-wallet-ws1-certification";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error("DENALI_WALLET_V1_REQUIRES_DATABASE_URL");
  }
  process.env.STORAGE_DRIVER = "prisma";
  await ensureAppTourCanReadMigrationHead();
  await seedDenaliDefaultWallet();
  await seedDenaliWalletPilot();
  console.log("seed-denali-wallet-v1: default + pilot complete");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
