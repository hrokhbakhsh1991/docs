import type { MigrationInterface, QueryRunner } from "typeorm";

export class EmailVerificationTokens1777591300000 implements MigrationInterface {
  name = "EmailVerificationTokens1777591300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "new_email" character varying(320) NOT NULL,
        "token" character varying(255) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_verification_tokens_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_verification_tokens_token"
      ON "email_verification_tokens" ("token")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_email_verification_tokens_user_id"
      ON "email_verification_tokens" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_email_verification_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_email_verification_tokens_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verification_tokens"`);
  }
}
