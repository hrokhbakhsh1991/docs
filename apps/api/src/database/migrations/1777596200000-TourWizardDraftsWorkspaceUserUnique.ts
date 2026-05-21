import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * One OCC draft row per (workspace, member). Drops duplicate rows (keeps highest version,
 * then latest updated_at) before adding the composite unique constraint.
 */
export class TourWizardDraftsWorkspaceUserUnique1777596200000 implements MigrationInterface {
  name = "TourWizardDraftsWorkspaceUserUnique1777596200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "tour_wizard_drafts" AS doomed
      WHERE doomed."id" NOT IN (
        SELECT DISTINCT ON ("workspace_id", "user_id") "id"
        FROM "tour_wizard_drafts"
        ORDER BY
          "workspace_id",
          "user_id",
          "version" DESC,
          "updated_at" DESC,
          "id" DESC
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "tour_wizard_drafts"
      ADD CONSTRAINT "UQ_tour_wizard_drafts_workspace_user"
      UNIQUE ("workspace_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_wizard_drafts"
      DROP CONSTRAINT IF EXISTS "UQ_tour_wizard_drafts_workspace_user"
    `);
  }
}
