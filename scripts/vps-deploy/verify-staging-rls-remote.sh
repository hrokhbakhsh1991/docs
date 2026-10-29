#!/usr/bin/env bash
# Read-only RLS catalog verification using the staging application's DB role.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/staging-ssh.sh
source "${SCRIPT_DIR}/lib/staging-ssh.sh"

[[ "${ENV_DIR:-/etc/app-tour-staging}" == "/etc/app-tour-staging" ]] || {
  echo "staging-rls-audit: environment directory rejected" >&2
  exit 1
}
ENV_DIR="/etc/app-tour-staging"

staging_ssh_cmd bash -s <<'REMOTE'
set -euo pipefail
ENV_FILE=/etc/app-tour-staging/api.env
[[ -r "$ENV_FILE" ]] || { echo "STAGING_RLS_AUDIT_FAIL missing-api-env" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
[[ -n "${DATABASE_URL:-}" ]] || { echo "STAGING_RLS_AUDIT_FAIL missing-app-database-url" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "STAGING_RLS_AUDIT_FAIL missing-psql" >&2; exit 1; }

DB_URL="$(python3 - <<'PY'
import os
from urllib.parse import urlparse, urlunparse
parsed = urlparse(os.environ["DATABASE_URL"])
print(urlunparse(parsed._replace(query="", fragment="")))
PY
)"
ROLE_INFO="$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -F '|' -c "SELECT current_database(), current_user, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname=current_user")"
[[ "$ROLE_INFO" == "tour_db_staging|app_tour|f|f" ]] || {
  echo "STAGING_RLS_AUDIT_FAIL unexpected-db-role" >&2
  exit 1
}
printf 'STAGING_DB_ROLE_OK db=tour_db_staging role=app_tour superuser=false bypassrls=false\n'

RLS_TABLES="$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -F '|' -c "WITH expected(table_name, require_policy) AS (VALUES ('tenants',false),('tenant_domains',false),('tours',true),('urban_registrations',true),('payments',true),('payment_receipts',true),('operator_registrations',true),('user_tenants',true),('mobile_otp_challenges',false)) SELECT e.table_name, COALESCE(c.relrowsecurity,false), COALESCE(c.relforcerowsecurity,false), COUNT(p.policyname), e.require_policy FROM expected e LEFT JOIN pg_class c ON c.relname=e.table_name AND c.relnamespace='public'::regnamespace LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.table_name GROUP BY e.table_name,c.oid,c.relrowsecurity,c.relforcerowsecurity,e.require_policy ORDER BY e.table_name")"
VIOLATIONS="$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "WITH expected(table_name, require_policy) AS (VALUES ('tenants',false),('tenant_domains',false),('tours',true),('urban_registrations',true),('payments',true),('payment_receipts',true),('operator_registrations',true),('user_tenants',true),('mobile_otp_challenges',false)), violations AS (SELECT e.table_name FROM expected e LEFT JOIN pg_class c ON c.relname=e.table_name AND c.relnamespace='public'::regnamespace LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.table_name GROUP BY e.table_name,c.oid,c.relrowsecurity,c.relforcerowsecurity,e.require_policy HAVING c.oid IS NULL OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR (e.require_policy AND COUNT(p.policyname)=0)) SELECT COUNT(*) FROM violations")"
[[ "$VIOLATIONS" == "0" ]] || {
  echo "STAGING_RLS_AUDIT_FAIL table-policy-contract" >&2
  printf '%s\n' "$RLS_TABLES" >&2
  exit 1
}
printf 'STAGING_RLS_CATALOG_OK core_tables=9\n'
printf '%s\n' "$RLS_TABLES" | while IFS='|' read -r table enabled forced policy_count requires_policy; do
  [[ -n "$table" ]] || continue
  printf 'STAGING_RLS_TABLE table=%s enabled=%s forced=%s policies=%s\n' "$table" "$enabled" "$forced" "$policy_count"
done
REMOTE
