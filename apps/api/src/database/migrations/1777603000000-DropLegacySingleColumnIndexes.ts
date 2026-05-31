import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Drops legacy single-column indexes that bypass tenant scope and replaces
 * tour_details single-column uniqueness with a tenant-scoped composite key.
 */
export class DropLegacySingleColumnIndexes1777603000000 implements MigrationInterface {
  name = "DropLegacySingleColumnIndexes1777603000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tour_details_tour_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tour_prices_departure"`);
    await queryRunner.query(`
      ALTER TABLE "tour_details" DROP CONSTRAINT IF EXISTS "UQ_tour_details_tour_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details"
      ADD CONSTRAINT "uq_tour_details_tenant_id_tour_id" UNIQUE ("tenant_id", "tour_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_details" DROP CONSTRAINT IF EXISTS "uq_tour_details_tenant_id_tour_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details"
      ADD CONSTRAINT "UQ_tour_details_tour_id" UNIQUE ("tour_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_details_tour_id"
      ON "tour_details" ("tour_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_prices_departure"
      ON "tour_prices" ("tour_departure_id")
    `);
  }
}
