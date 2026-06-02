import type { MigrationInterface, QueryRunner } from "typeorm";

export class SafetyProfileEmergencyAndMedical1777594300000 implements MigrationInterface {
  name = "SafetyProfileEmergencyAndMedical1777594300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "emergency_contacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "display_name" character varying(255) NOT NULL,
        "phone_e164" character varying(32) NOT NULL,
        "relationship" character varying(64) NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_emergency_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_emergency_contacts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_emergency_contacts_tenant_user"
      ON "emergency_contacts" ("tenant_id", "user_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "medical_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "encryption_schema_version" smallint NOT NULL DEFAULT 1,
        "ciphertext" bytea NOT NULL,
        "nonce" bytea NOT NULL,
        "auth_tag" bytea NOT NULL,
        "wrapped_content_key" bytea,
        "kms_key_id" character varying(128),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_medical_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_medical_profiles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_medical_profiles_tenant_user_active"
      ON "medical_profiles" ("tenant_id", "user_id")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_medical_profiles_tenant_user"
      ON "medical_profiles" ("tenant_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_medical_profiles_tenant_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_medical_profiles_tenant_user_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "medical_profiles"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_emergency_contacts_tenant_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "emergency_contacts"`);
  }
}
