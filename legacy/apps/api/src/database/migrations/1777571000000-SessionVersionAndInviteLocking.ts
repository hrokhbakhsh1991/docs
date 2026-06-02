import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Session versioning for JWT invalidation + invite row lock for atomic accept.
 */
export class SessionVersionAndInviteLocking1777571000000 implements MigrationInterface {
  name = "SessionVersionAndInviteLocking1777571000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.list_user_workspaces_for_auth(uuid)
    `);

    await queryRunner.query(`
      CREATE FUNCTION list_user_workspaces_for_auth(p_user_id uuid)
      RETURNS TABLE (
        tenant_id text,
        tenant_name text,
        role text,
        session_version integer
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
        SELECT ut.tenant_id::text AS tenant_id,
               t.name::text AS tenant_name,
               ut.role::text AS role,
               ut.session_version::integer AS session_version
        FROM user_tenants ut
        INNER JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL
        WHERE ut.user_id = p_user_id
          AND ut.deleted_at IS NULL
      $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION list_user_workspaces_for_auth(uuid) TO CURRENT_USER
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO tour_ops;
        END IF;
      END $$
    `);

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

        SELECT * INTO v_inv FROM workspace_invites WHERE token = p_token FOR UPDATE;
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
          role,
          session_version
        )
        VALUES (
          uuid_generate_v4(),
          v_inv.tenant_id,
          now(),
          now(),
          NULL,
          p_user_id,
          v_inv.role,
          1
        )
        ON CONFLICT (user_id, tenant_id)
        DO UPDATE SET
          deleted_at = NULL,
          role = EXCLUDED.role,
          updated_at = now(),
          session_version = user_tenants.session_version + 1;

        DELETE FROM workspace_invites WHERE id = v_inv.id;

        RETURN QUERY
          SELECT true, NULL::text, v_inv.tenant_id, v_inv.role::character varying;
      END
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.list_user_workspaces_for_auth(uuid)
    `);

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

    await queryRunner.query(`
      CREATE FUNCTION list_user_workspaces_for_auth(p_user_id uuid)
      RETURNS TABLE (
        tenant_id text,
        tenant_name text,
        role text
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
        SELECT ut.tenant_id::text AS tenant_id,
               t.name::text AS tenant_name,
               ut.role::text AS role
        FROM user_tenants ut
        INNER JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL
        WHERE ut.user_id = p_user_id
          AND ut.deleted_at IS NULL
      $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION list_user_workspaces_for_auth(uuid) TO CURRENT_USER
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO tour_ops;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tenants" DROP COLUMN IF EXISTS "session_version"
    `);
  }
}
