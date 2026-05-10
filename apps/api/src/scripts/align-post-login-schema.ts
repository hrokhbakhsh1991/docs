import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { MobileOtpChallenges1777591400000 } from "../database/migrations/1777591400000-MobileOtpChallenges";
import { TourTransportModesMultiSelect1777591100000 } from "../database/migrations/1777591100000-TourTransportModesMultiSelect";
import { WorkspaceInvitesCanonicalModel1777584000000 } from "../database/migrations/1777584000000-WorkspaceInvitesCanonicalModel";
import { WorkspaceRegionsAndDestinations1777591500000 } from "../database/migrations/1777591500000-WorkspaceRegionsAndDestinations";
import { WorkspaceEquipmentItems1777591700000 } from "../database/migrations/1777591700000-WorkspaceEquipmentItems";
import { WorkspaceTourThemes1777591900000 } from "../database/migrations/1777591900000-WorkspaceTourThemes";
import { WorkspaceGuideLanguages1777592000000 } from "../database/migrations/1777592000000-WorkspaceGuideLanguages";
import { TourDestinationId1777591600000 } from "../database/migrations/1777591600000-TourDestinationId";

async function main(): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    migrations: []
  });
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

    // `TourEntity` expects `transport_modes varchar[]`; older DBs only have `primary_transport_mode` enum.
    const transportModesPresent = (await dataSource.query(
      `SELECT 1 AS x FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tours' AND column_name = 'transport_modes' LIMIT 1`
    )) as unknown[];
    if (transportModesPresent.length === 0) {
      const primaryTransportPresent = (await dataSource.query(
        `SELECT 1 AS x FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tours' AND column_name = 'primary_transport_mode' LIMIT 1`
      )) as unknown[];
      const tourQr = dataSource.createQueryRunner();
      await tourQr.connect();
      await tourQr.startTransaction();
      try {
        if (primaryTransportPresent.length > 0) {
          await new TourTransportModesMultiSelect1777591100000().up(tourQr);
        } else {
          await tourQr.query(`
            ALTER TABLE "tours"
            ADD COLUMN IF NOT EXISTS "transport_modes" character varying array NOT NULL DEFAULT '{}'::character varying[]
          `);
        }
        await tourQr.commitTransaction();
      } catch (err) {
        await tourQr.rollbackTransaction();
        throw err;
      } finally {
        await tourQr.release();
      }
    }

    // Auth / invite / OTP tables: idempotent when migrations were not fully applied locally.
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await new WorkspaceInvitesCanonicalModel1777584000000().up(qr);
      await new MobileOtpChallenges1777591400000().up(qr);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    const qrLocations = dataSource.createQueryRunner();
    await qrLocations.connect();
    await qrLocations.startTransaction();
    try {
      await new WorkspaceRegionsAndDestinations1777591500000().up(qrLocations);
      await new TourDestinationId1777591600000().up(qrLocations);
      await new WorkspaceEquipmentItems1777591700000().up(qrLocations);
      await new WorkspaceTourThemes1777591900000().up(qrLocations);
      await new WorkspaceGuideLanguages1777592000000().up(qrLocations);
      await qrLocations.commitTransaction();
    } catch (err) {
      await qrLocations.rollbackTransaction();
      throw err;
    } finally {
      await qrLocations.release();
    }

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
            "tours.primary_transport_mode",
            "tours.transport_modes",
            "workspace_invites.canonical_model",
            "mobile_otp_challenges",
            "workspace_regions",
            "workspace_destinations",
            "tours.destination_id",
            "workspace_equipment_items",
            "workspace_tour_themes",
            "workspace_guide_languages"
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
