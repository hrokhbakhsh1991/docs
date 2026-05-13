import type { MigrationInterface, QueryRunner } from "typeorm";

const VALUES =
  "('general','mountain_outdoor','nature_trip','urban_event','cinema_event','cultural_tour')";

export class WorkspaceTourThemesFormProfile1777593800000 implements MigrationInterface {
  name = "WorkspaceTourThemesFormProfile1777593800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_tour_themes"
      ADD COLUMN IF NOT EXISTS "form_profile" character varying(32) NOT NULL DEFAULT 'general'
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_tour_themes"
      ADD CONSTRAINT "CHK_workspace_tour_themes_form_profile"
      CHECK ("form_profile" IN ${VALUES})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_tour_themes" DROP CONSTRAINT IF EXISTS "CHK_workspace_tour_themes_form_profile"`,
    );
    await queryRunner.query(`ALTER TABLE "workspace_tour_themes" DROP COLUMN IF EXISTS "form_profile"`);
  }
}
