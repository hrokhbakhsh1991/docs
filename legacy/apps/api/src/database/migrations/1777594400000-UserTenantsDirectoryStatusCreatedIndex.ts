import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Supports `GET /users` when filtering by membership_status: tenant + status + keyset order.
 * Complements the UsersListingSearchIndexes migration (tenant+role+created, tenant+created).
 */
export class UserTenantsDirectoryStatusCreatedIndex1777594400000 implements MigrationInterface {
  name = "UserTenantsDirectoryStatusCreatedIndex1777594400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_status_created_desc
      ON user_tenants (tenant_id, membership_status, created_at DESC, id DESC)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_tenants_tenant_status_created_desc`);
  }
}
