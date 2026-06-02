import { MigrationInterface, QueryRunner } from "typeorm";

export class BaselineSchema1777558732331 implements MigrationInterface {
    name = 'BaselineSchema1777558732331'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tour_lifecycle_status_enum') THEN CREATE TYPE "public"."tour_lifecycle_status_enum" AS ENUM('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tours" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "title" character varying(255) NOT NULL, "description" text, "total_capacity" integer NOT NULL DEFAULT '0', "accepted_count" integer NOT NULL DEFAULT '0', "lifecycle_status" "public"."tour_lifecycle_status_enum" NOT NULL DEFAULT 'DRAFT', "chat_link" character varying(2048), "cost_context" jsonb, CONSTRAINT "PK_2202ba445792c1ad0edf2de8de2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tours_lifecycle_status" ON "tours" ("lifecycle_status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tours_tenant_id" ON "tours" ("tenant_id") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_item_status_enum') THEN CREATE TYPE "public"."waitlist_item_status_enum" AS ENUM('Waiting', 'Converted', 'Cancelled'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "waitlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tour_id" uuid NOT NULL, "participant_full_name" character varying(255) NOT NULL, "participant_contact_phone" character varying(64) NOT NULL, "transport_mode" character varying(32) NOT NULL, "entry_mode" character varying(16) NOT NULL, "status" "public"."waitlist_item_status_enum" NOT NULL DEFAULT 'Waiting', "conversion_reason" character varying(64), "cancel_reason" character varying(255), "promoted_registration_id" uuid, CONSTRAINT "PK_0f951c0fa39c0468147cd7f0f24" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_waitlist_items_status" ON "waitlist_items" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_waitlist_items_tour_id" ON "waitlist_items" ("tour_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_waitlist_items_tenant_id" ON "waitlist_items" ("tenant_id") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_status_enum') THEN CREATE TYPE "public"."registration_status_enum" AS ENUM('Pending', 'Accepted', 'AcceptedPaid', 'Rejected', 'Cancelled', 'NoShow', 'Refunded'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_payment_status_enum') THEN CREATE TYPE "public"."registration_payment_status_enum" AS ENUM('NotPaid', 'Paid', 'Refunded', 'Failed', 'Partial'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "registrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tour_id" uuid NOT NULL, "participant_full_name" character varying(255) NOT NULL, "participant_contact_phone" character varying(64) NOT NULL, "transport_mode" character varying(32) NOT NULL, "entry_mode" character varying(16) NOT NULL, "telegram_user_id" character varying(255), "telegram_username" character varying(255), "vehicle_seat_capacity" integer, "participant_note" text, "status" "public"."registration_status_enum" NOT NULL DEFAULT 'Pending', "payment_status" "public"."registration_payment_status_enum" NOT NULL DEFAULT 'NotPaid', "paid_amount" numeric, "payment_metadata" jsonb, CONSTRAINT "PK_6013e724d7b22929da9cd7282d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_registrations_payment_status" ON "registrations" ("payment_status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_registrations_status" ON "registrations" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_registrations_tour_id" ON "registrations" ("tour_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_registrations_tenant_id" ON "registrations" ("tenant_id") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN CREATE TYPE "public"."payment_status_enum" AS ENUM('Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "registration_id" uuid NOT NULL, "amount" numeric NOT NULL, "currency" character varying(8) NOT NULL, "provider" character varying(64) NOT NULL, "provider_payment_id" character varying(128), "status" "public"."payment_status_enum" NOT NULL DEFAULT 'Pending', "paid_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "refunded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_payments_provider_payment_id" ON "payments" ("provider_payment_id") WHERE "provider_payment_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "payments" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_registration_id" ON "payments" ("registration_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_tenant_id" ON "payments" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_registration_pending" ON "payments" ("registration_id") WHERE "status" = 'Pending'`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbox_event_status_enum') THEN CREATE TYPE "public"."outbox_event_status_enum" AS ENUM('PENDING', 'DELIVERED', 'FAILED'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "outbox_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "aggregate_type" character varying(64) NOT NULL, "aggregate_id" uuid NOT NULL, "event_type" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "status" "public"."outbox_event_status_enum" NOT NULL DEFAULT 'PENDING', "retry_count" integer NOT NULL DEFAULT '0', "next_retry_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_outbox_events_aggregate" ON "outbox_events" ("aggregate_type", "aggregate_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_outbox_events_status_created_at" ON "outbox_events" ("status", "created_at") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "role" character varying(64) NOT NULL, CONSTRAINT "uq_user_tenants_user_id_tenant_id" UNIQUE ("user_id", "tenant_id"), CONSTRAINT "PK_aff681c6ee0171ce3cb116ea83f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_tenants_user_id" ON "user_tenants" ("user_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_tenants_tenant_id" ON "user_tenants" ("tenant_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(320) NOT NULL, "telegram_user_id" character varying, "hashed_password" character varying(255) NOT NULL, "full_name" character varying(255), "is_email_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_903574be044ba37381996813b12" UNIQUE ("telegram_user_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "key" character varying(255) NOT NULL, "endpoint" character varying(255) NOT NULL, "request_hash" character varying(128) NOT NULL, "response_body" jsonb, "status_code" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_idempotency_tenant_id" ON "idempotency_keys" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_idempotency_expires_at" ON "idempotency_keys" ("expires_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_idempotency_tenant_key" ON "idempotency_keys" ("tenant_id", "key") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_69f1c8b72630a5094abf2ccf60b') THEN ALTER TABLE "waitlist_items" ADD CONSTRAINT "FK_69f1c8b72630a5094abf2ccf60b" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ad8a84081f720c93e0c88c477eb') THEN ALTER TABLE "registrations" ADD CONSTRAINT "FK_ad8a84081f720c93e0c88c477eb" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_dcf8450959aadff1b025a2434d7') THEN ALTER TABLE "payments" ADD CONSTRAINT "FK_dcf8450959aadff1b025a2434d7" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_63a8ef4ed4fad61231cdfc3dc63') THEN ALTER TABLE "user_tenants" ADD CONSTRAINT "FK_63a8ef4ed4fad61231cdfc3dc63" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_a1feca39273dfd9a32c7cc4153c') THEN ALTER TABLE "user_tenants" ADD CONSTRAINT "FK_a1feca39273dfd9a32c7cc4153c" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`
            DO $$
            DECLARE row_item RECORD;
            BEGIN
              FOR row_item IN
                SELECT table_schema, table_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND column_name = 'tenant_id'
              LOOP
                EXECUTE format(
                  'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
                  row_item.table_schema,
                  row_item.table_name
                );

                EXECUTE format(
                  'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
                  row_item.table_schema,
                  row_item.table_name
                );

                IF NOT EXISTS (
                  SELECT 1
                  FROM pg_policies
                  WHERE schemaname = row_item.table_schema
                    AND tablename = row_item.table_name
                    AND policyname = 'tenant_isolation_policy'
                ) THEN
                  EXECUTE format(
                    'CREATE POLICY tenant_isolation_policy ON %I.%I USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)',
                    row_item.table_schema,
                    row_item.table_name
                  );
                END IF;
              END LOOP;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Destructive reset migration: intended for ephemeral/dev teardown only.
        // Do not use as a production rollback strategy.
        await queryRunner.query(`
            DO $$
            DECLARE row_item RECORD;
            BEGIN
              FOR row_item IN
                SELECT table_schema, table_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND column_name = 'tenant_id'
              LOOP
                EXECUTE format(
                  'DROP POLICY IF EXISTS tenant_isolation_policy ON %I.%I',
                  row_item.table_schema,
                  row_item.table_name
                );
                EXECUTE format(
                  'ALTER TABLE %I.%I NO FORCE ROW LEVEL SECURITY',
                  row_item.table_schema,
                  row_item.table_name
                );
                EXECUTE format(
                  'ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY',
                  row_item.table_schema,
                  row_item.table_name
                );
              END LOOP;
            END
            $$;
        `);
        await queryRunner.query(`ALTER TABLE "user_tenants" DROP CONSTRAINT "FK_a1feca39273dfd9a32c7cc4153c"`);
        await queryRunner.query(`ALTER TABLE "user_tenants" DROP CONSTRAINT "FK_63a8ef4ed4fad61231cdfc3dc63"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_dcf8450959aadff1b025a2434d7"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_ad8a84081f720c93e0c88c477eb"`);
        await queryRunner.query(`ALTER TABLE "waitlist_items" DROP CONSTRAINT "FK_69f1c8b72630a5094abf2ccf60b"`);
        await queryRunner.query(`DROP INDEX "public"."uq_idempotency_tenant_key"`);
        await queryRunner.query(`DROP INDEX "public"."idx_idempotency_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_idempotency_expires_at"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_tenants_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_tenants_user_id"`);
        await queryRunner.query(`DROP TABLE "user_tenants"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
        await queryRunner.query(`DROP INDEX "public"."idx_outbox_events_status_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_outbox_events_aggregate"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`DROP TYPE "public"."outbox_event_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_registration_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_status"`);
        await queryRunner.query(`DROP INDEX "public"."uq_payments_registration_pending"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_provider_payment_id"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payment_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_registrations_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_registrations_tour_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_registrations_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_registrations_payment_status"`);
        await queryRunner.query(`DROP TABLE "registrations"`);
        await queryRunner.query(`DROP TYPE "public"."registration_payment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."registration_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_waitlist_items_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_waitlist_items_tour_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_waitlist_items_status"`);
        await queryRunner.query(`DROP TABLE "waitlist_items"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_item_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tours_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tours_lifecycle_status"`);
        await queryRunner.query(`DROP TABLE "tours"`);
        await queryRunner.query(`DROP TYPE "public"."tour_lifecycle_status_enum"`);
    }

}
