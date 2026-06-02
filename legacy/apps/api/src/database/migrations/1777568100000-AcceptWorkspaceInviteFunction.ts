import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Accepts a workspace invite by opaque token: validates email match, upserts user_tenants,
 * deletes the invite row. SECURITY DEFINER + row_security=off so the flow works regardless
 * of JWT tenant context / RLS on workspace_invites and user_tenants.
 */
export class AcceptWorkspaceInviteFunction1777568100000 implements MigrationInterface {
  name = "AcceptWorkspaceInviteFunction1777568100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION accept_workspace_invite_by_token(
        p_token text,
        p_user_id uuid,
        p_user_email text
      )
      RETURNS TABLE (
        ok boolean,
        error_code text,
        out_tenant_id uuid,
        out_role character varying
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
      DECLARE
        v_inv workspace_invites%ROWTYPE;
        v_email text;
      BEGIN
        v_email := lower(trim(p_user_email));

        SELECT * INTO v_inv FROM workspace_invites WHERE token = p_token;
        IF NOT FOUND THEN
          RETURN QUERY
            SELECT false, 'INVITE_NOT_FOUND'::text, NULL::uuid, NULL::character varying;
          RETURN;
        END IF;

        IF v_inv.expires_at < now() THEN
          DELETE FROM workspace_invites WHERE id = v_inv.id;
          RETURN QUERY
            SELECT false, 'INVITE_EXPIRED'::text, NULL::uuid, NULL::character varying;
          RETURN;
        END IF;

        IF lower(trim(v_inv.email)) <> v_email THEN
          RETURN QUERY
            SELECT false, 'INVITE_EMAIL_MISMATCH'::text, NULL::uuid, NULL::character varying;
          RETURN;
        END IF;

        IF lower(trim(v_inv.role)) = 'owner' THEN
          RETURN QUERY
            SELECT false, 'OWNER_ROLE_INVITE_FORBIDDEN'::text, NULL::uuid, NULL::character varying;
          RETURN;
        END IF;

        INSERT INTO user_tenants (
          id,
          tenant_id,
          created_at,
          updated_at,
          deleted_at,
          user_id,
          role
        )
        VALUES (
          uuid_generate_v4(),
          v_inv.tenant_id,
          now(),
          now(),
          NULL,
          p_user_id,
          v_inv.role
        )
        ON CONFLICT (user_id, tenant_id)
        DO UPDATE SET
          deleted_at = NULL,
          role = EXCLUDED.role,
          updated_at = now();

        DELETE FROM workspace_invites WHERE id = v_inv.id;

        RETURN QUERY
          SELECT true, NULL::text, v_inv.tenant_id, v_inv.role::character varying;
      END
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS accept_workspace_invite_by_token(text, uuid, text)
    `);
  }
}
