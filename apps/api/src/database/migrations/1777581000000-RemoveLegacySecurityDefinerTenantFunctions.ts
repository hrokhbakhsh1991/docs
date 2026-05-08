import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveLegacySecurityDefinerTenantFunctions1777581000000
  implements MigrationInterface
{
  name = "RemoveLegacySecurityDefinerTenantFunctions1777581000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.list_user_workspaces_for_auth(uuid)
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.accept_workspace_invite_by_token(text, uuid, text)
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.resolve_tour_tenant_for_public_flow(uuid)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally no-op: legacy SECURITY DEFINER functions are removed in favor
    // of application-layer tenant management through SystemManager + RLS bindings.
  }
}
