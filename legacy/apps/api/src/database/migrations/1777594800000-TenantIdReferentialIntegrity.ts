import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * P1-A — Tenant column inventory (tables with `tenant_id` in `public` at migration time):
 *
 * - `booking_price_snapshots`, `emergency_contacts`, `idempotency_keys`, `medical_profiles`,
 *   `outbox_events`, `payments`, `registrations`, `tenant_audit_events`, `tenant_usage_daily`,
 *   `tenant_plan_limits`, `tour_departures`, `tour_products`, `tours`, `user_role_audit`,
 *   `user_tenants`, `waitlist_items`, `workspace_destinations`, `workspace_invites`,
 *   `workspace_regions`
 *
 * Adds **missing** `FOREIGN KEY (tenant_id) REFERENCES tenants(id)` where absent.
 * Existing composite / partial uniques (e.g. `idempotency_keys`, `outbox_events`, `user_tenants`,
 * `tour_products`, `medical_profiles`) are unchanged.
 */
export class TenantIdReferentialIntegrity1777594800000 implements MigrationInterface {
  name = "TenantIdReferentialIntegrity1777594800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const addFk = async (table: string, constraintName: string): Promise<void> => {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}'
          ) THEN
            ALTER TABLE "${table}"
              ADD CONSTRAINT "${constraintName}"
              FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
              ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
        END $$
      `);
    };

    await addFk("registrations", "fk_registrations_tenant");
    await addFk("payments", "fk_payments_tenant");
    await addFk("waitlist_items", "fk_waitlist_items_tenant");
    await addFk("idempotency_keys", "fk_idempotency_keys_tenant");
    await addFk("emergency_contacts", "fk_emergency_contacts_tenant");
    await addFk("booking_price_snapshots", "fk_booking_price_snapshots_tenant");
    await addFk("workspace_invites", "fk_workspace_invites_tenant");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_invites" DROP CONSTRAINT IF EXISTS "fk_workspace_invites_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_price_snapshots" DROP CONSTRAINT IF EXISTS "fk_booking_price_snapshots_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "emergency_contacts" DROP CONSTRAINT IF EXISTS "fk_emergency_contacts_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" DROP CONSTRAINT IF EXISTS "fk_idempotency_keys_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "waitlist_items" DROP CONSTRAINT IF EXISTS "fk_waitlist_items_tenant"`
    );
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "fk_payments_tenant"`);
    await queryRunner.query(
      `ALTER TABLE "registrations" DROP CONSTRAINT IF EXISTS "fk_registrations_tenant"`
    );
  }
}
