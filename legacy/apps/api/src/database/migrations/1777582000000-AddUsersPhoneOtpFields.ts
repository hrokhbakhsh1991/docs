import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsersPhoneOtpFields1777582000000 implements MigrationInterface {
  name = "AddUsersPhoneOtpFields1777582000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "phone" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_phone_verified" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_phone" ON "users" ("phone")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION phone_normalized(p_phone text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      RETURNS NULL ON NULL INPUT
      AS $$
        SELECT NULLIF(regexp_replace(trim(p_phone), '[^0-9+]', '', 'g'), '');
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS phone_normalized(text)`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_phone"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "is_phone_verified"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "phone"
    `);
  }
}
