import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceTourCreationPresets1777593700000 implements MigrationInterface {
  name = "WorkspaceTourCreationPresets1777593700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_tour_creation_presets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "match_tour_type" character varying(64),
        "match_main_tour_theme_id" uuid,
        "defaults" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_tour_creation_presets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_tour_creation_presets_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_workspace_tour_creation_presets_match_theme"
          FOREIGN KEY ("match_main_tour_theme_id") REFERENCES "workspace_tour_themes"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_tour_creation_presets_workspace_id"
      ON "workspace_tour_creation_presets" ("workspace_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_tour_creation_presets_workspace_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_tour_creation_presets"`);
  }
}
