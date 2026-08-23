# PROD-8 Operations

Status: release-candidate control document for PROD-8 (immutable deployment, observability, rollback, operations).

## Scope

PROD-8 hardens the supported VPS/systemd four-process deployment model certified by PROD-4. It does not replace workspace, tour, finance, or package architecture.

## Immutable artifact (R8-01..R8-06)

| Task | Command | Evidence |
| --- | --- | --- |
| R8-01 preflight | `pnpm run prod8:artifact-preflight` | `.artifacts/prod8/artifact-preflight.json` |
| R8-02..06 bundle | `pnpm run prod8:immutable-bundle` | `.artifacts/prod8/immutable-bundle.json` |
| Full RC package | `bash scripts/vps-deploy/package-immutable-release.sh <sha>` | `.artifacts/prod8/prod8-release-<sha>.tar.gz` |

Policy:

- Build production artifacts once from an exact SHA.
- Include API, Admin (web), Portal, Marketing, migrations, workspace manifests, and runtime metadata.
- Emit checksums, SBOM, provenance, build manifest, and deployment fingerprint.
- Staging and production must deploy the same `deployment_fingerprint`.
- Fail closed on dirty worktree when `PROD8_REQUIRE_CLEAN=1`.
- A dirty checkout may verify machinery but must not be attested as a clean immutable RC.

## Deployment workflow (R8-07..R8-17)

| Control | Enforcement |
| --- | --- |
| No arbitrary main-push production deploy | `deploy-vps.yml` is `workflow_dispatch` + RC input only |
| Approved RC/tag | `release_ref` input must match `refs/tags/rc-*` or annotated release tag |
| Production approval | GitHub `environment: production` |
| L3 eligibility | `pnpm run release:verify` on target SHA before deploy |
| No server install/build on critical deploy | `deploy-immutable-release.sh` activates pre-built tree |
| Versioned releases | `/srv/app-tour/releases/<sha>` + `/srv/app-tour/current` symlink |
| Migration preflight | `migration-head-preflight.ts` + `db:migrate:deploy` |
| Restore point | `pre-migrate-pg-dump.sh` before migrate |
| Readiness + smoke | `smoke-four-process.sh` + `smoke-operator-login.sh` |
| Rollback | `rollback-vps.sh` requires `ROLLBACK_DB_DUMP` unless explicit code-only unsafe path |

### Immutable VPS deploy

```bash
# CI packages release
bash scripts/vps-deploy/package-immutable-release.sh <sha>

# VPS activates pre-built tarball
RELEASE_TARBALL=/tmp/prod8-release-<sha>.tar.gz \
  DEPLOY_ROOT=/srv/app-tour ENV_DIR=/etc/app-tour \
  bash scripts/vps-deploy/deploy-immutable-release.sh
```

On smoke failure, deploy script attempts paired rollback and fails into incident procedure `docs/phase-23/runbooks/p10-incident-four-process.md` INC-02.

## Observability and operations (R8-18..R8-27)

| Area | Tooling | Live infra |
| --- | --- | --- |
| Availability/latency/error/saturation dashboards | `deploy/ops/vps-availability-dashboard.json` | Requires Prometheus scrape of API metrics |
| DB pool / Redis / outbox alerts | `deploy/alerts/phase5-slo.yaml` + `deploy/ops/vps-alert-ownership.yaml` | Requires Prometheus Operator or equivalent |
| Correlation logging | `trace-request-context.ts`, `request-logging.ts` | Active in API runtime |
| Log retention/rotation | `deploy/ops/vps-logrotate.conf` | Install on VPS |
| Migration-head drift | `migration-head-preflight.ts` | API boot + `guard:migration-head-preflight` |
| Deployment SHA drift | Compare `/srv/app-tour/.active-release-sha` with intended RC | VPS ops check |
| Backup freshness | `pnpm run prod8:backup-freshness` | Local dump dir or VPS path |
| Restore drill | `scripts/restore-drill-smoke.sh` | Requires Postgres |
| Service restart rehearsal | `pnpm run p10:ops-drill` | Local dry-run or VPS |
| Rollback rehearsal | `ROLLBACK_DRY_RUN=1 bash scripts/vps-deploy/rollback-vps-dry-run.sh` | Local static |
| Incident/on-call | `docs/phase-23/runbooks/p10-incident-four-process.md` | Active runbook |

### RPO/RTO

Canonical targets (DEC-125):

| Objective | Target | Evidence source |
| --- | --- | --- |
| RPO | ≤ 15 minutes | Managed Postgres WAL/PITR (provider) |
| RTO | ≤ 60 minutes | Restore + migrate verify + smoke |

Measured deploy/rollback timing is recorded only from real staging/production drills. This document does not fabricate timings.

## External blockers

| Item | Status |
| --- | --- |
| Real staging VPS | BLOCKED — environment unavailable |
| Real production VPS | BLOCKED — environment unavailable |
| R5-21 provider backup evidence | BLOCKED — external |
| R7-29 staging acceptance | BLOCKED — requires staging + immutable RC |
| Live Prometheus/Grafana | BLOCKED — not provisioned in this session |

## Verification

```bash
pnpm run prod8:deployment-gate
```

CI workflow: `.github/workflows/prod-8-deployment-gate.yml`

## Deployment SHA drift

On VPS:

```bash
cat /srv/app-tour/.active-release-sha
cat /srv/app-tour/.previous-release-sha
```

Alert when active SHA differs from the approved RC digest in the release record.
