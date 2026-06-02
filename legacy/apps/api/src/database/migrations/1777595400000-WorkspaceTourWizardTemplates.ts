import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceTourWizardTemplates1777595400000 implements MigrationInterface {
  name = "WorkspaceTourWizardTemplates1777595400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_tour_wizard_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "base_profile" varchar(32) NOT NULL DEFAULT 'general',
        "step_overrides" jsonb NOT NULL DEFAULT '{"skip":[],"insert":[]}'::jsonb,
        "field_rules_overlay" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "preset_id" uuid,
        "wizard_contract_version" int NOT NULL DEFAULT 1,
        "form_profile_version" int NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_tour_wizard_templates_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_tour_wizard_templates_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_workspace_tour_wizard_templates_workspace_id" UNIQUE ("workspace_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_tour_wizard_templates_workspace_id"
      ON "workspace_tour_wizard_templates" ("workspace_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_tour_wizard_templates_workspace_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_tour_wizard_templates"`);
  }
}
