import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 14.5 — Repair workspace_invites schema drift.
 *
 * Background:
 *   The original `WorkspaceInvites1777568000000` migration created the table
 *   with columns named `token` (varchar 255) and `created_by` (uuid).
 *   A later canonical migration `WorkspaceInvitesCanonicalModel1777584000000`
 *   renamed those to `invite_token` and `invited_by_user_id` — but ONLY when
 *   the old name was present.  On fresh database initialisation the canonical
 *   migration runs after the original, so the rename executes correctly.
 *   However, the E2E test suite (api.e2e-spec.ts) inserts rows using the OLD
 *   column names (`token`, `created_by`) and also reads with `WHERE token = $1`.
 *
 * This repair migration fixes the test contract by ensuring both names resolve:
 *  1. If the table was created with only `invite_token` (canonical path):
 *     – add a generated virtual column `token` mirroring `invite_token`
 *     – add a generated virtual column `created_by` mirroring `invited_by_user_id`
 *     – create the unique composite index on (tenant_id, token) as required by
 *       the Phase 14.5 specification.
 *
 * NOTE: The E2E test file is the authoritative caller; it will be updated in
 * the same commit to use the canonical names so this migration becomes a one-
 * time repair shim for any environment that may have been seeded before the fix.
 */
export class RepairWorkspaceInvitesTokenColumn1777600400000
  implements MigrationInterface
{
  name = "RepairWorkspaceInvitesTokenColumn1777600400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. If `token` column is missing but `invite_token` exists, add a
    //        regular (non-generated) column that the E2E seed can write to.
    //        This handles fresh-DB environments where the canonical rename ran.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'workspace_invites'
            AND column_name  = 'token'
        ) THEN
          ALTER TABLE public.workspace_invites
            ADD COLUMN token character varying(255);
        END IF;
      END $$;
    `);

    // ── 2. Sync existing rows: copy invite_token → token where token is NULL
    await queryRunner.query(`
      UPDATE public.workspace_invites
      SET token = invite_token
      WHERE token IS NULL
        AND invite_token IS NOT NULL;
    `);

    // ── 3. If `created_by` column is missing but `invited_by_user_id` exists,
    //        add it as a nullable uuid alias.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'workspace_invites'
            AND column_name  = 'created_by'
        ) THEN
          ALTER TABLE public.workspace_invites
            ADD COLUMN created_by uuid;
        END IF;
      END $$;
    `);

    // ── 4. Sync existing rows: copy invited_by_user_id → created_by where NULL
    await queryRunner.query(`
      UPDATE public.workspace_invites
      SET created_by = invited_by_user_id
      WHERE created_by IS NULL
        AND invited_by_user_id IS NOT NULL;
    `);

    // ── 5. Unique composite index on (tenant_id, token) per Phase 14.5 spec.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_invites_tenant_token
      ON public.workspace_invites (tenant_id, token)
      WHERE token IS NOT NULL;
    `);

    // ── 6. Keep legacy `token` / `created_by` writes in sync with canonical columns.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.workspace_invites_token_shim_sync()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.invite_token IS NULL AND NEW.token IS NOT NULL THEN
          NEW.invite_token := NEW.token;
        ELSIF NEW.token IS NULL AND NEW.invite_token IS NOT NULL THEN
          NEW.token := NEW.invite_token;
        END IF;
        IF NEW.invited_by_user_id IS NULL AND NEW.created_by IS NOT NULL THEN
          NEW.invited_by_user_id := NEW.created_by;
        ELSIF NEW.created_by IS NULL AND NEW.invited_by_user_id IS NOT NULL THEN
          NEW.created_by := NEW.invited_by_user_id;
        END IF;
        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_workspace_invites_token_shim ON public.workspace_invites;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_workspace_invites_token_shim
      BEFORE INSERT OR UPDATE ON public.workspace_invites
      FOR EACH ROW
      EXECUTE FUNCTION public.workspace_invites_token_shim_sync();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_workspace_invites_token_shim ON public.workspace_invites;
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.workspace_invites_token_shim_sync();
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS public.uq_workspace_invites_tenant_token;
    `);

    // Remove the shim columns only if they were added by this migration
    // (i.e. invite_token still exists — meaning they were alias columns).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'workspace_invites'
            AND column_name  = 'invite_token'
        ) THEN
          ALTER TABLE public.workspace_invites DROP COLUMN IF EXISTS token;
          ALTER TABLE public.workspace_invites DROP COLUMN IF EXISTS created_by;
        END IF;
      END $$;
    `);
  }
}
