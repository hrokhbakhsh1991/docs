# SECURITY DEFINER registry

PostgreSQL `SECURITY DEFINER` functions bypass row-level security. Any function created or invoked from **runtime API code** (outside migrations) must be listed here.

## Active runtime `SECURITY DEFINER` functions

Active runtime `SECURITY DEFINER` functions: **none**

Runtime SQL in `apps/api/src` (excluding `database/migrations/`) does not define or invoke undocumented `SECURITY DEFINER` helpers.

## Migration-only functions

`SECURITY DEFINER` definitions in TypeORM migrations are tracked in migration history, not in this runtime registry. See `apps/api/src/database/migrations/` for bootstrap/auth helpers (e.g. workspace invite acceptance, auth subdomain listing).

## Maintenance

When adding runtime `SECURITY DEFINER` SQL outside migrations, document each function as:

`public.<function_name>(...)`

and justify tenant scoping in the PR.
