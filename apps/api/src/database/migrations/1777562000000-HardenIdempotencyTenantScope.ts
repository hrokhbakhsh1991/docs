import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenIdempotencyTenantScope1777562000000 implements MigrationInterface {
  name = "HardenIdempotencyTenantScope1777562000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "idempotency_keys"
      ADD COLUMN IF NOT EXISTS "tenant_id" uuid
    `);
    await queryRunner.query(`
      TRUNCATE TABLE "idempotency_keys"
    `);
    await queryRunner.query(`
      ALTER TABLE "idempotency_keys"
      ALTER COLUMN "tenant_id" SET NOT NULL
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_idempotency_key"
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_idempotency_tenant_id"
      ON "idempotency_keys" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_idempotency_tenant_key"
      ON "idempotency_keys" ("tenant_id", "key")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_idempotency_tenant_key"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_idempotency_tenant_id"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_idempotency_key"
      ON "idempotency_keys" ("key")
    `);
    await queryRunner.query(`
      ALTER TABLE "idempotency_keys"
      DROP COLUMN IF EXISTS "tenant_id"
    `);
  }
}
