import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTourDetailsTable1777587000000 implements MigrationInterface {
  name = "CreateTourDetailsTable1777587000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
          CREATE TYPE "public"."difficulty_level" AS ENUM ('easy', 'moderate', 'hard', 'technical');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tour_details" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tour_id" uuid NOT NULL,
        "destination_name" character varying,
        "elevation_m" integer,
        "difficulty" "public"."difficulty_level",
        "duration_days" integer,
        "meeting_point" character varying,
        "required_gear" jsonb,
        "itinerary" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_details_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tour_details_tour_id" UNIQUE ("tour_id"),
        CONSTRAINT "FK_tour_details_tour_id" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tour_details"`);
    await queryRunner.query(`
      DO $$
      DECLARE
        dependency_count integer;
      BEGIN
        SELECT COUNT(*)
        INTO dependency_count
        FROM pg_type t
        JOIN pg_attribute a ON a.atttypid = t.oid
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.typname = 'difficulty_level'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND n.nspname = 'public';

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level')
           AND dependency_count = 0 THEN
          DROP TYPE "public"."difficulty_level";
        END IF;
      END
      $$;
    `);
  }
}
