import type { MigrationInterface, QueryRunner } from "typeorm";

export class MobileOtpChallenges1777591400000 implements MigrationInterface {
  name = "MobileOtpChallenges1777591400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_otp_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "mobile" character varying(64) NOT NULL,
        "purpose" character varying(32) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mobile_otp_challenges_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_mobile_otp_challenges_mobile_purpose"
      ON "mobile_otp_challenges" ("mobile", "purpose")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_mobile_otp_challenges_mobile_purpose"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_otp_challenges"`);
  }
}
