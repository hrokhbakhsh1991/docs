# P6 staging VPS boundary (89.45.89.206)

```yaml
runbook_id: P6-STAGING-VPS-BOUNDARY
nano: P6-4-N-006
host: 89.45.89.206
hostname: tourapp
```

## Production — do not modify

| Resource | Value |
| -------- | ----- |
| Deploy path | `/opt/app-tour` |
| Branch | `main` |
| systemd | `app-tour-api.service` · `app-tour-web.service` |
| Env | `/etc/app-tour/api.env` · `/etc/app-tour/web.env` |
| API port | **13001** |
| Web port | **13000** |
| Postgres DB | **`tour_db_prod`** (app role via `DATABASE_URL`) |
| MinIO bucket | **`app-tour-prod`** |
| Postgres port | **5433** (native PG 12) |

## Staging (live — P6 fast-close 2026-06-23)

| Resource | Value |
| -------- | ----- |
| Deploy path | `/opt/app-tour-staging` |
| systemd prefix | `app-tour-staging-*` |
| Env dir | `/etc/app-tour-staging/` (mode `750`, group `app-tour`) |
| Ports | API **23001** · web **23000** · marketing **23002** · portal **23003** |
| Postgres DB | **`tour_db_staging`** |
| MinIO bucket | **`app-tour-staging`** |
| API runtime | tsx (lite deploy — prod `.next` copied · **BLK-P7-00** blocks `/tours/new`) |
| Smoke | `TOUR_OPS_API_URL=http://127.0.0.1:23001 node scripts/smoke-p6-host-bind.mjs` |

Units need `Environment=DEPLOY_PATH` and `Environment=ENV_DIR` in systemd (templates updated) — or start scripts default to prod paths.

**Fast wiring (no build):** `bash /opt/app-tour-staging/scripts/vps-deploy/bootstrap-staging.sh`  
**Long steps:** TEMP/FOR YOU.md (historical local scratch `FOR YOU.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)

## QA sandbox to remove (Track E1)

| Resource | Value |
| -------- | ----- |
| Path | `/root/docs` (old DEV checkout) |
| Stale API | `:23001` root-owned `tsx src/main.ts` |
| Zombie tests | `node --import tsx --test` processes |

## Infra shared (read-only for staging setup)

- Redis: `127.0.0.1:6379`
- MinIO API: `127.0.0.1:9002` (use **separate bucket**)
- Postgres: `127.0.0.1:5433` (use **separate database**)

## Verification

```bash
# Prod health (should stay OK after staging work)
curl -s http://127.0.0.1:13001/health

# Staging must NOT use prod DB name
grep DATABASE_URL /etc/app-tour-staging/api.env   # must NOT contain tour_db_prod
```

See [p6-remaining-checklist.md](../p6-remaining-checklist.md) Track A.
