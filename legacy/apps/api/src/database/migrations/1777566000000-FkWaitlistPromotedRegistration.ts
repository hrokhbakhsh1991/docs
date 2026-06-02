import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Foreign key: waitlist_items.promoted_registration_id → registrations.id
 *
 * Orphan pointers (non-null id with no matching registration row) are set to NULL so the
 * constraint can be applied without failing; waitlist rows themselves are preserved.
 */
export class FkWaitlistPromotedRegistration1777566000000 implements MigrationInterface {
  name = "FkWaitlistPromotedRegistration1777566000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "waitlist_items" w
      SET "promoted_registration_id" = NULL
      WHERE w."promoted_registration_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "registrations" r
          WHERE r."id" = w."promoted_registration_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_waitlist_items_promoted_registration'
        ) THEN
          ALTER TABLE "waitlist_items"
            ADD CONSTRAINT "fk_waitlist_items_promoted_registration"
            FOREIGN KEY ("promoted_registration_id") REFERENCES "registrations"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$
    `);
  }

  /**
   * Rollback: drop fk_waitlist_items_promoted_registration from waitlist_items.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "waitlist_items"
      DROP CONSTRAINT IF EXISTS "fk_waitlist_items_promoted_registration"
    `);
  }
}
