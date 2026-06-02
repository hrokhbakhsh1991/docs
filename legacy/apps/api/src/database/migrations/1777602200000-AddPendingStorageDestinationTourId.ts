import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Links pending clone-storage rows to the destination tour so cleanup never deletes
 * objects referenced by a persisted tour row.
 */
export class AddPendingStorageDestinationTourId1777602200000 implements MigrationInterface {
  name = "AddPendingStorageDestinationTourId1777602200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_storage_deletions"
      ADD COLUMN "destination_tour_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_pending_storage_deletions_destination_tour_id"
      ON "pending_storage_deletions" ("destination_tour_id")
      WHERE "destination_tour_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pending_storage_deletions_destination_tour_id"`);
    await queryRunner.query(`
      ALTER TABLE "pending_storage_deletions"
      DROP COLUMN IF EXISTS "destination_tour_id"
    `);
  }
}
