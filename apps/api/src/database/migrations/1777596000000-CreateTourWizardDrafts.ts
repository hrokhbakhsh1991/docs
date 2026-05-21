import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTourWizardDrafts1777596000000 implements MigrationInterface {
  name = "CreateTourWizardDrafts1777596000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tour_wizard_drafts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "current_step_index" int NOT NULL DEFAULT 0,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_wizard_drafts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tour_wizard_drafts_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tour_wizard_drafts_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_tour_wizard_drafts_workspace_id"
      ON "tour_wizard_drafts" ("workspace_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_tour_wizard_drafts_workspace_id"`);
    await queryRunner.query(`DROP TABLE "tour_wizard_drafts"`);
  }
}
