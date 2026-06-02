/**
 * PostgreSQL session variable used by RLS policies (`current_setting('app.tenant_id')`).
 * `set_config(..., true)` applies transaction-local scope (equivalent to SET LOCAL).
 */
export const RLS_TENANT_SETTING = "app.tenant_id";

export const SET_LOCAL_RLS_TENANT_SQL = `SELECT set_config('${RLS_TENANT_SETTING}', $1, true)`;

export const RESET_RLS_TENANT_SQL = `RESET ${RLS_TENANT_SETTING}`;
