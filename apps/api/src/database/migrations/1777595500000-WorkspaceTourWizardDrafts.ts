import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceTourWizardDrafts1777595500000 implements MigrationInterface {
  name = "WorkspaceTourWizardDrafts1777595500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_tour_wizard_drafts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "envelope" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "wizard_contract_version" int NOT NULL DEFAULT 1,
        "row_version" int NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_tour_wizard_drafts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_tour_wizard_drafts_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_workspace_tour_wizard_drafts_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_workspace_tour_wizard_drafts_workspace_user"
          UNIQUE ("workspace_id", "user_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_tour_wizard_drafts_workspace_user"
      ON "workspace_tour_wizard_drafts" ("workspace_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_workspace_tour_wizard_drafts_workspace_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_tour_wizard_drafts"`);
  }
}
