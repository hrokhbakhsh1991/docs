import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceEquipmentCompatibleCategories1777601400000 implements MigrationInterface {
  name = "WorkspaceEquipmentCompatibleCategories1777601400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_equipment_items"
      ADD COLUMN IF NOT EXISTS "compatible_categories" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "workspace_equipment_items"
      SET "compatible_categories" = CASE
        WHEN lower(trim("category")) IN ('mountain', 'nature', 'desert', 'event')
          THEN jsonb_build_array(lower(trim("category")))
        ELSE '[]'::jsonb
      END
      WHERE "category" IS NOT NULL AND trim("category") <> ''
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace_equipment_items" DROP COLUMN IF EXISTS "category"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_equipment_items"
      ADD COLUMN IF NOT EXISTS "category" character varying(80)
    `);

    await queryRunner.query(`
      UPDATE "workspace_equipment_items"
      SET "category" = CASE
        WHEN jsonb_array_length("compatible_categories") > 0
          THEN "compatible_categories"->>0
        ELSE NULL
      END
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace_equipment_items" DROP COLUMN IF EXISTS "compatible_categories"
    `);
  }
}
