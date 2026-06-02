import { MigrationInterface, QueryRunner } from "typeorm";

export class TenantAuditEvents1777576000000 implements MigrationInterface {
  name = "TenantAuditEvents1777576000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_audit_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actor_user_id" uuid,
        "actor" character varying(320) NOT NULL,
        "user_id" uuid,
        "action" character varying(96) NOT NULL,
        "resource_type" character varying(96) NOT NULL DEFAULT '',
        "resource_id" character varying(128),
        "metadata" jsonb,
        "client_ip" character varying(128) NOT NULL DEFAULT 'unknown',
        "request_id" character varying(128),
        CONSTRAINT "PK_tenant_audit_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_audit_events_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenant_audit_events_tenant_occurred"
      ON "tenant_audit_events" ("tenant_id", "occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenant_audit_events_tenant_action"
      ON "tenant_audit_events" ("tenant_id", "action")
    `);

    await queryRunner.query(`
      ALTER TABLE "tenant_audit_events" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_audit_events" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'tenant_audit_events'
            AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy ON tenant_audit_events
          USING (tenant_id = current_setting('app.tenant_id')::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION reject_tenant_audit_events_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'tenant_audit_events is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS tenant_audit_events_append_only ON tenant_audit_events
    `);
    await queryRunner.query(`
      CREATE TRIGGER tenant_audit_events_append_only
      BEFORE UPDATE OR DELETE ON tenant_audit_events
      FOR EACH ROW EXECUTE FUNCTION reject_tenant_audit_events_mutation()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS tenant_audit_events_append_only ON tenant_audit_events
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS reject_tenant_audit_events_mutation()
    `);
    await queryRunner.query(`
      DROP POLICY IF EXISTS tenant_isolation_policy ON tenant_audit_events
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_audit_events" NO FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_audit_events" DISABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_tenant_audit_events_tenant_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_tenant_audit_events_tenant_occurred"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_audit_events"`);
  }
}
