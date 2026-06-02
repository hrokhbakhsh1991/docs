import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceRegionsAndDestinations1777591500000 implements MigrationInterface {
  name = "WorkspaceRegionsAndDestinations1777591500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_regions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "country" character varying(128),
        "sort_order" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_regions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_regions_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_regions_tenant_id"
      ON "workspace_regions" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_destinations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "region_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "type" character varying(64),
        "altitude_m" integer,
        "sort_order" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_destinations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_destinations_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_workspace_destinations_region_id"
          FOREIGN KEY ("region_id") REFERENCES "workspace_regions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_destinations_tenant_id"
      ON "workspace_destinations" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_destinations_region_id"
      ON "workspace_destinations" ("region_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_destinations_region_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_destinations_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_destinations"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_regions_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_regions"`);
  }
}
