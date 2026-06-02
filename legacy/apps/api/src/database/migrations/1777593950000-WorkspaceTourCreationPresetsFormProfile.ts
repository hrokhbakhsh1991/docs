import type { MigrationInterface, QueryRunner } from "typeorm";

const VALUES =
  "('general','mountain_outdoor','nature_trip','urban_event','cinema_event','cultural_tour')";

export class WorkspaceTourCreationPresetsFormProfile1777593950000 implements MigrationInterface {
  name = "WorkspaceTourCreationPresetsFormProfile1777593950000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_tour_creation_presets"
      ADD COLUMN IF NOT EXISTS "form_profile" character varying(32) NOT NULL DEFAULT 'general'
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_tour_creation_presets"
      ADD CONSTRAINT "CHK_workspace_tour_creation_presets_form_profile"
      CHECK ("form_profile" IN ${VALUES})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_tour_creation_presets" DROP CONSTRAINT IF EXISTS "CHK_workspace_tour_creation_presets_form_profile"`,
    );
    await queryRunner.query(`ALTER TABLE "workspace_tour_creation_presets" DROP COLUMN IF EXISTS "form_profile"`);
  }
}
