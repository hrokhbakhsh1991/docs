import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";

async function main(): Promise<void> {
  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();
  try {
    await dataSource.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ NULL
    `);

    await dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
          CREATE TYPE "public"."difficulty_level" AS ENUM ('easy', 'moderate', 'hard', 'technical');
        END IF;
      END
      $$;
    `);

    await dataSource.query(`
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

    await dataSource.query(`
      ALTER TABLE "tour_details"
      ADD COLUMN IF NOT EXISTS "trip_details" jsonb NULL
    `);

    await dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tour_type_enum') THEN
          CREATE TYPE "public"."tour_type_enum" AS ENUM ('camp', 'mountain', 'city', 'desert', 'other');
        END IF;
      END
      $$;
    `);

    await dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'primary_transport_mode_enum') THEN
          CREATE TYPE "public"."primary_transport_mode_enum" AS ENUM ('bus', 'train', 'plane', 'private_car', 'mixed', 'none');
        END IF;
      END
      $$;
    `);

    await dataSource.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "auto_accept_registrations" boolean NULL
    `);
    await dataSource.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "tour_type" "public"."tour_type_enum" NULL
    `);
    await dataSource.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "primary_transport_mode" "public"."primary_transport_mode_enum" NULL
    `);

    // Ensure canonical constraint names exist when table was created with drifted metadata.
    await dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_tour_details_tour_id'
        ) THEN
          ALTER TABLE "tour_details"
          ADD CONSTRAINT "UQ_tour_details_tour_id" UNIQUE ("tour_id");
        END IF;
      END
      $$;
    `);

    console.log(
      JSON.stringify(
        {
          status: "ok",
          aligned: [
            "users.last_login_at",
            "tour_details",
            "difficulty_level",
            "tours.auto_accept_registrations",
            "tours.tour_type",
            "tours.primary_transport_mode"
          ]
        },
        null,
        2
      )
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
