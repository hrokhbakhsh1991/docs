import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Row-level validation for `tenants.subdomain` (nullable rollout-safe).
 *
 * Rules enforced here match application validators:
 * - lowercase only
 * - no whitespace
 * - no dots (single DNS-label style)
 * - optional hyphenated segments; length 1–63 (varchar width)
 *
 * Uniqueness among active tenants stays on the partial unique index from
 * migration `1777575000000-TenantSubdomain.ts` (`uq_tenants_subdomain_active_lower`).
 *
 * Idempotent: skips if `chk_tenants_subdomain_format` already exists.
 */
export class TenantSubdomainFormatCheck1777575050000 implements MigrationInterface {
  name = "TenantSubdomainFormatCheck1777575050000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_subdomain_format'
        ) THEN
          ALTER TABLE "tenants"
          ADD CONSTRAINT "chk_tenants_subdomain_format" CHECK (
            "subdomain" IS NULL
            OR (
              char_length("subdomain") BETWEEN 1 AND 63
              AND "subdomain" = lower("subdomain")
              AND "subdomain" !~ '[[:space:]]'
              AND "subdomain" !~ '\\.'
              AND "subdomain" ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
            )
          );
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP CONSTRAINT IF EXISTS "chk_tenants_subdomain_format"
    `);
  }
}
