/**
 * Removes legacy `[Demo]` fake tours for leader@test.com (no re-insert).
 * Run from apps/api: pnpm seed:demo-leader-tours
 */
import { DataSource, IsNull } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";
import { TourEntity } from "../modules/tours/entities/tour.entity";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";

const LEADER_EMAIL = "leader@test.com";
const DEMO_TITLE_PREFIX = "[Demo] ";

async function run(): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity, TourEntity],
  });

  await dataSource.initialize();
  try {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(UserTenantEntity);

    const leader = await userRepo.findOne({
      where: { email: LEADER_EMAIL, deletedAt: IsNull() },
    });
    if (!leader) {
      emitScriptInfo(`User not found: ${LEADER_EMAIL}. Nothing to purge.`);
      return;
    }

    const membership = await membershipRepo.findOne({
      where: { userId: leader.id, deletedAt: IsNull() },
    });
    if (!membership) {
      emitScriptInfo(`No tenant membership for ${LEADER_EMAIL}. Nothing to purge.`);
      return;
    }

    const result = await dataSource.query<Array<{ count: string }>>(
      `WITH deleted AS (
         UPDATE tours
         SET deleted_at = now()
         WHERE tenant_id = $1
           AND deleted_at IS NULL
           AND title LIKE $2
         RETURNING 1
       )
       SELECT count(*)::text AS count FROM deleted`,
      [membership.tenantId, `${DEMO_TITLE_PREFIX}%`],
    );
    const removed = Number(result[0]?.count ?? 0);
    emitScriptInfo(
      `Soft-deleted ${removed} legacy demo tour(s) for ${LEADER_EMAIL} @ tenant ${membership.tenantId}.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(
    "seed-demo-leader-tours failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
