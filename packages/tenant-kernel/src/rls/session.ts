/**
 * PostgreSQL session variable for RLS (MIGRATION-MAP §7.1).
 * `set_config(..., true)` applies transaction-local scope (SET LOCAL).
 */
export const RLS_TENANT_SETTING = "app.current_tenant_id";

export const SET_LOCAL_RLS_TENANT_SQL = `SELECT set_config('${RLS_TENANT_SETTING}', $1::text, true)`;

export const RESET_RLS_TENANT_SQL = `RESET ${RLS_TENANT_SETTING}`;
