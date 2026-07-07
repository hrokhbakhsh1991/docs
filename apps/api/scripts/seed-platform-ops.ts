/**
 * P1-G — idempotent seed for platform_ops_users from PLATFORM_OPS_SEED env.
 *
 * Format: comma-separated `phone:role` pairs, e.g.
 *   PLATFORM_OPS_SEED="+10000000001:owner,+10000000002:support"
 *
 * Run: pnpm --filter @apps/api exec node --import tsx scripts/seed-platform-ops.ts
 */
import { parsePlatformOpsSeed } from "../src/platform/parse-platform-ops-seed.ts";
import { PlatformOpsUserRepository } from "../src/platform/platform-ops-user.repository.ts";

export { parsePlatformOpsSeed };

export async function seedPlatformOpsUsers(
  deps: { repository?: PlatformOpsUserRepository; seedCsv?: string } = {}
): Promise<number> {
  const seeds = parsePlatformOpsSeed(deps.seedCsv);
  const repository = deps.repository ?? new PlatformOpsUserRepository();
  for (const seed of seeds) {
    await repository.upsert(seed);
  }
  return seeds.length;
}

async function main(): Promise<void> {
  const count = await seedPlatformOpsUsers();
  console.log(JSON.stringify({ event: "seed.platform_ops", count }));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
