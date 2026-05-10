import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceGuideLanguages1777592000000 implements MigrationInterface {
  name = "WorkspaceGuideLanguages1777592000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_guide_languages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_guide_languages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_guide_languages_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_guide_languages_workspace_id"
      ON "workspace_guide_languages" ("workspace_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workspace_guide_languages_workspace_slug"
      ON "workspace_guide_languages" ("workspace_id", "slug")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_guide_languages_workspace_slug"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_guide_languages_workspace_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_guide_languages"`);
  }
}
