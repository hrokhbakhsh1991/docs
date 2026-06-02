import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bootstrap tenant resolution for anonymous public routes (register/waitlist).
 * SELECT on tenant-scoped tables requires app.tenant_id under RLS; this SECURITY DEFINER
 * helper reads only tours.tenant_id by primary key before session tenant is set.
 *
 * row_security = off is required because baseline migrations enable FORCE ROW LEVEL SECURITY
 * on tenant tables (owners are still subject to RLS).
 */
export class ResolveTourTenantForPublicFlow1777564000000 implements MigrationInterface {
  name = "ResolveTourTenantForPublicFlow1777564000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION resolve_tour_tenant_for_public_flow(p_tour_id uuid)
      RETURNS uuid
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
        SELECT tenant_id
        FROM tours
        WHERE id = p_tour_id
          AND deleted_at IS NULL
      $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION resolve_tour_tenant_for_public_flow(uuid) TO CURRENT_USER
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) TO tour_ops;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          REVOKE EXECUTE ON FUNCTION resolve_tour_tenant_for_public_flow(uuid) FROM tour_ops;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS resolve_tour_tenant_for_public_flow(uuid)
    `);
  }
}
