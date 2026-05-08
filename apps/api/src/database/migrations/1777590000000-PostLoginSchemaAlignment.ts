import type { MigrationInterface, QueryRunner } from "typeorm";

export class PostLoginSchemaAlignment1777590000000 implements MigrationInterface {
  name = "PostLoginSchemaAlignment1777590000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ NULL
    `);

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
        CONSTRAINT "FK_tour_details_tour_id" FOREIGN KEY ("tour_id")
          REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tour_type_enum') THEN
          CREATE TYPE "public"."tour_type_enum" AS ENUM ('camp', 'mountain', 'city', 'desert', 'other');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'primary_transport_mode_enum') THEN
          CREATE TYPE "public"."primary_transport_mode_enum" AS ENUM ('bus', 'train', 'plane', 'private_car', 'mixed', 'none');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "auto_accept_registrations" boolean NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "tour_type" "public"."tour_type_enum" NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "primary_transport_mode" "public"."primary_transport_mode_enum" NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_details_tour_id"
      ON "tour_details" ("tour_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tours_created_at"
      ON "tours" ("created_at")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tours'
            AND column_name = 'workspace_id'
        ) THEN
          CREATE INDEX IF NOT EXISTS "idx_tours_workspace_id"
          ON "tours" ("workspace_id");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionally non-destructive rollback for safe environments.
    // This migration only performs additive alignment and index creation.
    await queryRunner.query(`SELECT 1`);
  }
}
