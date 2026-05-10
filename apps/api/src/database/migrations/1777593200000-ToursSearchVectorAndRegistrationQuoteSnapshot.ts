import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Full-text search column for tour list; optional price snapshot columns on registrations.
 */
export class ToursSearchVectorAndRegistrationQuoteSnapshot1777593200000
  implements MigrationInterface
{
  name = "ToursSearchVectorAndRegistrationQuoteSnapshot1777593200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', COALESCE("title", '')), 'A')
        || setweight(to_tsvector('simple', COALESCE("description", '')), 'B')
      ) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tours_search_vector"
      ON "tours" USING gin ("search_vector")
    `);

    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "quoted_list_price_minor" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "quoted_currency_code" character varying(3)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN IF EXISTS "quoted_currency_code"`);
    await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN IF EXISTS "quoted_list_price_minor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tours_search_vector"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "search_vector"`);
  }
}
