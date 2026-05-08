import { MigrationInterface, QueryRunner } from "typeorm";

export class EnforceAtLeastOneActiveOwnerPerWorkspace1777574000000 implements MigrationInterface {
  name = "EnforceAtLeastOneActiveOwnerPerWorkspace1777574000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ensure_exactly_one_active_owner_per_workspace()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_tenant_id uuid;
        v_owner_count integer;
      BEGIN
        v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

        IF v_tenant_id IS NULL THEN
          RETURN NULL;
        END IF;

        SELECT COUNT(*)::integer
          INTO v_owner_count
        FROM user_tenants
        WHERE tenant_id = v_tenant_id
          AND deleted_at IS NULL
          AND lower(role) = 'owner';

        IF v_owner_count = 0 THEN
          RAISE EXCEPTION 'workspace % must have at least one active owner', v_tenant_id
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ck_user_tenants_workspace_requires_owner';
        END IF;

        RETURN NULL;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_ensure_exactly_one_active_owner_per_workspace ON user_tenants;
    `);

    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER trg_ensure_exactly_one_active_owner_per_workspace
      AFTER INSERT OR UPDATE OR DELETE ON user_tenants
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION ensure_exactly_one_active_owner_per_workspace();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_ensure_exactly_one_active_owner_per_workspace ON user_tenants;
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS ensure_exactly_one_active_owner_per_workspace();
    `);
  }
}
