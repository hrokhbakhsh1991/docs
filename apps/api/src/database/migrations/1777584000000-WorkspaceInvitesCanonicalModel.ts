import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceInvitesCanonicalModel1777584000000 implements MigrationInterface {
  name = "WorkspaceInvitesCanonicalModel1777584000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'workspace_invite_status_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE public.workspace_invite_status_enum AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'token'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'invite_token'
        ) THEN
          ALTER TABLE public.workspace_invites
          RENAME COLUMN token TO invite_token;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'created_by'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'invited_by_user_id'
        ) THEN
          ALTER TABLE public.workspace_invites
          RENAME COLUMN created_by TO invited_by_user_id;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE public.workspace_invites
      ADD COLUMN IF NOT EXISTS status public.workspace_invite_status_enum
    `);

    await queryRunner.query(`
      ALTER TABLE public.workspace_invites
      ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE public.workspace_invites
      SET invited_at = created_at
      WHERE invited_at IS NULL
    `);

    await queryRunner.query(`
      UPDATE public.workspace_invites
      SET status = CASE
        WHEN expires_at < now() THEN 'EXPIRED'::public.workspace_invite_status_enum
        ELSE 'PENDING'::public.workspace_invite_status_enum
      END
      WHERE status IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE public.workspace_invites
      ALTER COLUMN status SET DEFAULT 'PENDING'::public.workspace_invite_status_enum
    `);

    await queryRunner.query(`
      ALTER TABLE public.workspace_invites
      ALTER COLUMN status SET NOT NULL
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS public.uq_workspace_invites_token
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_invites_invite_token
      ON public.workspace_invites (invite_token)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.accept_workspace_invite_by_token(
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

        SELECT * INTO v_inv FROM workspace_invites WHERE invite_token = p_token FOR UPDATE;
        IF NOT FOUND THEN
          RETURN QUERY
            SELECT false, 'INVITE_NOT_FOUND'::text, NULL::uuid, NULL::character varying;
          RETURN;
        END IF;

        IF v_inv.status = 'ACCEPTED'::workspace_invite_status_enum THEN
          RETURN QUERY
            SELECT false, 'INVITE_ALREADY_ACCEPTED'::text, NULL::uuid, NULL::character varying;
          RETURN;
        END IF;

        IF v_inv.status = 'EXPIRED'::workspace_invite_status_enum OR v_inv.expires_at < now() THEN
          UPDATE workspace_invites
          SET status = 'EXPIRED'::workspace_invite_status_enum
          WHERE id = v_inv.id;
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

        UPDATE workspace_invites
        SET status = 'ACCEPTED'::workspace_invite_status_enum
        WHERE id = v_inv.id;

        RETURN QUERY
          SELECT true, NULL::text, v_inv.tenant_id, v_inv.role::character varying;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS public.uq_workspace_invites_invite_token
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_invites_token
      ON public.workspace_invites (invite_token)
    `);

    await queryRunner.query(`
      ALTER TABLE public.workspace_invites
      DROP COLUMN IF EXISTS status
    `);

    await queryRunner.query(`
      ALTER TABLE public.workspace_invites
      DROP COLUMN IF EXISTS invited_at
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'invite_token'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'token'
        ) THEN
          ALTER TABLE public.workspace_invites
          RENAME COLUMN invite_token TO token;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'invited_by_user_id'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'workspace_invites'
            AND column_name = 'created_by'
        ) THEN
          ALTER TABLE public.workspace_invites
          RENAME COLUMN invited_by_user_id TO created_by;
        END IF;
      END $$;
    `);
  }
}
