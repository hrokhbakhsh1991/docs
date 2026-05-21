import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTourWizardDraftVersion1777596100000 implements MigrationInterface {
  name = "AddTourWizardDraftVersion1777596100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_wizard_drafts"
      ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_wizard_drafts"
      DROP COLUMN IF EXISTS "version"
    `);
  }
}
