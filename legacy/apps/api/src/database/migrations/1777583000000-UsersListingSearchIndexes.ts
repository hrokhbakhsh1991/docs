import type { MigrationInterface, QueryRunner } from "typeorm";

export class UsersListingSearchIndexes1777583000000 implements MigrationInterface {
  name = "UsersListingSearchIndexes1777583000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_created_desc
      ON user_tenants (tenant_id, created_at DESC, id DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_role_created_desc
      ON user_tenants (tenant_id, lower(role), created_at DESC, id DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
      ON users
      USING gin (lower(coalesce(full_name, '')) gin_trgm_ops)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_trgm
      ON users
      USING gin (lower(email) gin_trgm_ops)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_phone_normalized
      ON users (phone_normalized(coalesce(phone, '')))
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_phone_normalized`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_email_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_full_name_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_tenants_tenant_role_created_desc`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_tenants_tenant_created_desc`);
  }
}
