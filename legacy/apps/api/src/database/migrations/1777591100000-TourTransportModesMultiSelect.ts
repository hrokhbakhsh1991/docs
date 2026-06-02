import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Replace single `primary_transport_mode` enum (incl. `mixed` / `none`) with
 * `transport_modes varchar[]` for true multi-select. `mixed` is removed —
 * leaders pick every concrete mode that applies.
 *
 * Data migration:
 * - `mixed` → all concrete modes
 * - `none` / NULL → `{}`
 * - single enum values → one-element arrays
 */
export class TourTransportModesMultiSelect1777591100000 implements MigrationInterface {
  name = "TourTransportModesMultiSelect1777591100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "transport_modes" character varying array NOT NULL DEFAULT '{}'::character varying[]
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'tours' AND column_name = 'primary_transport_mode'
        ) THEN
          UPDATE "tours"
          SET "transport_modes" = CASE "primary_transport_mode"::text
            WHEN 'bus' THEN ARRAY['bus']::character varying[]
            WHEN 'train' THEN ARRAY['train']::character varying[]
            WHEN 'plane' THEN ARRAY['plane']::character varying[]
            WHEN 'private_car' THEN ARRAY['private_car']::character varying[]
            WHEN 'mixed' THEN ARRAY['bus', 'train', 'plane', 'private_car']::character varying[]
            WHEN 'none' THEN ARRAY[]::character varying[]
            ELSE ARRAY[]::character varying[]
          END;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "tours" DROP COLUMN IF EXISTS "primary_transport_mode"
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."primary_transport_mode_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."primary_transport_mode_enum" AS ENUM('bus', 'train', 'plane', 'private_car', 'mixed', 'none')
    `);

    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN "primary_transport_mode" "public"."primary_transport_mode_enum" NULL
    `);

    await queryRunner.query(`
      UPDATE "tours" SET "primary_transport_mode" = CASE
        WHEN cardinality("transport_modes") = 0 THEN NULL
        WHEN cardinality("transport_modes") > 1 THEN 'mixed'::"public"."primary_transport_mode_enum"
        WHEN "transport_modes"[1]::text = 'bus' THEN 'bus'::"public"."primary_transport_mode_enum"
        WHEN "transport_modes"[1]::text = 'train' THEN 'train'::"public"."primary_transport_mode_enum"
        WHEN "transport_modes"[1]::text = 'plane' THEN 'plane'::"public"."primary_transport_mode_enum"
        WHEN "transport_modes"[1]::text = 'private_car' THEN 'private_car'::"public"."primary_transport_mode_enum"
        ELSE NULL
      END
    `);

    await queryRunner.query(`
      ALTER TABLE "tours" DROP COLUMN "transport_modes"
    `);
  }
}
