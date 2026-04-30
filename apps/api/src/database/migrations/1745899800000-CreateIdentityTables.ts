import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIdentityTables1745899800000 implements MigrationInterface {
  name = "CreateIdentityTables1745899800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_tenants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(320) NOT NULL,
        "hashed_password" character varying(255) NOT NULL,
        "full_name" character varying(255),
        "is_email_verified" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_tenants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        "user_id" uuid NOT NULL,
        "role" character varying(64) NOT NULL,
        CONSTRAINT "PK_user_tenants_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_tenants_user_id_tenant_id" UNIQUE ("user_id", "tenant_id"),
        CONSTRAINT "FK_user_tenants_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_tenants_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_user_tenants_tenant_id" ON "user_tenants" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_user_tenants_user_id" ON "user_tenants" ("user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tenants" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "user_tenants" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation_policy"
      ON "user_tenants"
      USING (tenant_id = current_setting('app.tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user_tenants"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_tenants" NO FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "user_tenants" DISABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_user_tenants_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_user_tenants_tenant_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_tenants"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_users_email"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "users"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "tenants"
    `);
  }
}
