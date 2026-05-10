import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Refine the `tour_type_enum` to clarify category semantics:
 *
 * - **Drop** legacy values that overlapped with `tripStyle` ("genre"):
 *   `camp` and `other`.
 * - **Add** category values: `nature`, `cultural`.
 *
 * Final enum (alphabetical for stable readability): city, cultural, desert, mountain, nature.
 *
 * Existing rows are migrated:
 *   - `camp`  → `nature` (camps almost always run in nature/outdoors)
 *   - `other` → `NULL`  (it was a placeholder; let leaders re-classify)
 *
 * Postgres does **not** allow dropping enum values in place, so we recreate the
 * type and `ALTER COLUMN ... USING` to map existing rows in a single step.
 */
export class RefineTourTypeEnum1777591000000 implements MigrationInterface {
  name = "RefineTourTypeEnum1777591000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."tour_type_enum" RENAME TO "tour_type_enum_old"`);

    await queryRunner.query(
      `CREATE TYPE "public"."tour_type_enum" AS ENUM('mountain', 'city', 'desert', 'nature', 'cultural')`
    );

    await queryRunner.query(`
      ALTER TABLE "tours"
      ALTER COLUMN "tour_type" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "tours"
      ALTER COLUMN "tour_type" TYPE "public"."tour_type_enum"
      USING (
        CASE "tour_type"::text
          WHEN 'camp'  THEN 'nature'
          WHEN 'other' THEN NULL
          ELSE "tour_type"::text
        END
      )::"public"."tour_type_enum"
    `);

    await queryRunner.query(`DROP TYPE "public"."tour_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."tour_type_enum" RENAME TO "tour_type_enum_new"`);

    await queryRunner.query(
      `CREATE TYPE "public"."tour_type_enum" AS ENUM('camp', 'mountain', 'city', 'desert', 'other')`
    );

    await queryRunner.query(`
      ALTER TABLE "tours"
      ALTER COLUMN "tour_type" TYPE "public"."tour_type_enum"
      USING (
        CASE "tour_type"::text
          WHEN 'nature'   THEN 'other'
          WHEN 'cultural' THEN 'other'
          ELSE "tour_type"::text
        END
      )::"public"."tour_type_enum"
    `);

    await queryRunner.query(`DROP TYPE "public"."tour_type_enum_new"`);
  }
}
