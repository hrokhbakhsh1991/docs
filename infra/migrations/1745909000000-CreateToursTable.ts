import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateToursTable1745909000000 implements MigrationInterface {
  name = "CreateToursTable1745909000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'tour_lifecycle_status_enum'
        ) THEN
          CREATE TYPE "tour_lifecycle_status_enum" AS ENUM (
            'DRAFT',
            'OPEN',
            'CLOSED',
            'CANCELLED'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "tours" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "total_capacity" integer NOT NULL DEFAULT 0,
        "accepted_count" integer NOT NULL DEFAULT 0,
        "lifecycle_status" "tour_lifecycle_status_enum" NOT NULL DEFAULT 'DRAFT',
        "chat_link" character varying(2048),
        "cost_context" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_tours_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tours_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tours_tenant_id" ON "tours" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_tours_lifecycle_status" ON "tours" ("lifecycle_status")
    `);

    await queryRunner.query(`
      ALTER TABLE "tours" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tours" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation_policy"
      ON "tours"
      USING (tenant_id = current_setting('app.tenant_id')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tours"
    `);
    await queryRunner.query(`
      ALTER TABLE "tours" NO FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tours" DISABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_tours_lifecycle_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_tours_tenant_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "tours"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "tour_lifecycle_status_enum"
    `);
  }
}
