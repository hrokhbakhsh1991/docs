import { MigrationInterface, QueryRunner } from "typeorm";

/** Tenant-scoped extension bag (arbitrary JSON) — avoids enum migrations for custom vertical fields. */
export class ToursMetadataColumn1777601700000 implements MigrationInterface {
  name = "ToursMetadataColumn1777601700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours" DROP COLUMN IF EXISTS "metadata"
    `);
  }
}
