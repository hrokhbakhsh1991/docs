import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdempotencyKeys1746060000000 implements MigrationInterface {
  name = "AddIdempotencyKeys1746060000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(255) NOT NULL,
        "endpoint" character varying(255) NOT NULL,
        "request_hash" character varying(128) NOT NULL,
        "response_body" jsonb,
        "status_code" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_idempotency_keys_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_idempotency_key" ON "idempotency_keys" ("key")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_keys" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_idempotency_expires_at"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_idempotency_key"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "idempotency_keys"
    `);
  }
}
