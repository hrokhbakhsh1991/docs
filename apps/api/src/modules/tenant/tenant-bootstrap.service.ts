import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";

/** Same DDL as `1777564000000-ResolveTourTenantForPublicFlow.ts` (split for clarity). */
const RESOLVE_TOUR_TENANT_FN_BODY = `
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
`;

const GRANT_RESOLVE_TOUR_TENANT_FN = `
GRANT EXECUTE ON FUNCTION resolve_tour_tenant_for_public_flow(uuid) TO CURRENT_USER
`;

const GRANT_TOUR_OPS_IF_EXISTS = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
    GRANT EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) TO tour_ops;
  END IF;
END $$
`;

function shouldAutoCreatePublicTourTenantFunction(): boolean {
  const v = process.env.DATABASE_AUTO_CREATE_PUBLIC_FLOW_FUNCTION?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Resolves `tenant_id` for a tour **before** `app.tenant_id` session binding exists.
 *
 * Used **only** for anonymous “public bootstrap” HTTP flows (e.g. `POST …/tours/:tourId/register`,
 * `POST …/tours/:tourId/waitlist`) where RLS would otherwise block reading `tours`. Calls the
 * database function `resolve_tour_tenant_for_public_flow`. Do **not** use for authenticated
 * routes — those must rely on JWT-bound tenant context.
 */
@Injectable()
export class TenantBootstrapService implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    if (!shouldAutoCreatePublicTourTenantFunction()) {
      return;
    }
    await this.ensureResolveTourTenantFunctionExists();
  }

  private async ensureResolveTourTenantFunctionExists(): Promise<void> {
    const existsRows = await this.dataSource.query<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'resolve_tour_tenant_for_public_flow'
      ) AS "exists"
    `);
    if (existsRows[0]?.exists) {
      return;
    }
    try {
      await this.dataSource.query(RESOLVE_TOUR_TENANT_FN_BODY);
      await this.dataSource.query(GRANT_RESOLVE_TOUR_TENANT_FN);
      await this.dataSource.query(GRANT_TOUR_OPS_IF_EXISTS);
    } catch {
      // Best-effort only; run migrations or apply DDL as a superuser if the app role cannot CREATE FUNCTION.
    }
  }

  async resolveTenantFromTourId(tourId: string): Promise<string | null> {
    const rows = await this.dataSource.query<
      Array<{ resolve_tour_tenant_for_public_flow: string | null }>
    >(`SELECT resolve_tour_tenant_for_public_flow($1::uuid)`, [tourId]);
    const value = rows[0]?.resolve_tour_tenant_for_public_flow;
    return value ?? null;
  }
}
