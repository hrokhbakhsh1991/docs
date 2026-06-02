import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds optional human-readable subdomain per tenant (workspace routing label).
 *
 * Canonical tenant identity remains `tenants.id` (UUID).
 *
 * Backfill strategy (run separately when ready — NOT executed here):
 * - For each row with subdomain IS NULL and deleted_at IS NULL:
 *   - Derive a candidate from lower(trim(regexp_replace(name, '\\s+', '-', 'g'))) or similar slug rules,
 *     constrained to [a-z0-9-], max length 63, strip leading/trailing hyphens.
 *   - If collision on lower(subdomain) among active rows, append '-' || left(id::text, 8) or a numeric suffix.
 * - After all active tenants have values, optionally enforce NOT NULL + app validation in a follow-up migration.
 */
export class TenantSubdomain1777575000000 implements MigrationInterface {
  name = "TenantSubdomain1777575000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "subdomain" character varying(63) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenants_subdomain_active_lower"
      ON "tenants" (lower("subdomain"))
      WHERE "deleted_at" IS NULL AND "subdomain" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."uq_tenants_subdomain_active_lower"
    `);

    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "subdomain"
    `);
  }
}
