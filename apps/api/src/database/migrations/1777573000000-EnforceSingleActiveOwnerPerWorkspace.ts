import { MigrationInterface, QueryRunner } from "typeorm";

export class EnforceSingleActiveOwnerPerWorkspace1777573000000 implements MigrationInterface {
  name = "EnforceSingleActiveOwnerPerWorkspace1777573000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_owners AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_id
            ORDER BY created_at ASC, id ASC
          ) AS owner_rank
        FROM user_tenants
        WHERE deleted_at IS NULL
          AND lower(role) = 'owner'
      )
      UPDATE user_tenants ut
      SET role = 'admin',
          session_version = session_version + 1,
          updated_at = now()
      FROM ranked_owners ro
      WHERE ut.id = ro.id
        AND ro.owner_rank > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_tenants_active_owner_per_workspace
      ON user_tenants (tenant_id)
      WHERE deleted_at IS NULL AND lower(role) = 'owner'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_user_tenants_active_owner_per_workspace
    `);
  }
}
