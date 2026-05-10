import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceTourThemes1777591900000 implements MigrationInterface {
  name = "WorkspaceTourThemes1777591900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_tour_themes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_tour_themes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_tour_themes_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_tour_themes_workspace_id"
      ON "workspace_tour_themes" ("workspace_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workspace_tour_themes_workspace_slug"
      ON "workspace_tour_themes" ("workspace_id", "slug")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_tour_themes_workspace_slug"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_tour_themes_workspace_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_tour_themes"`);
  }
}
