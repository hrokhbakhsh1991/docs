# P7 — Staging rollback runbook

```yaml
runbook_id: P7-STAGING-ROLLBACK
authority: deploy/vps/README.md · p7-0-live-infra.md
```

> Use when a deploy breaks staging or seed corrupts tenant data.

---

## 1. Stop services (safe order)

```bash
systemctl stop app-tour-portal app-tour-marketing app-tour-web app-tour-api
# or:
bash /opt/app-tour/scripts/vps-deploy/stop-stale-listeners.sh
```

---

## 2. Roll back application code

```bash
cd /opt/app-tour
git fetch origin main
git reset --hard origin/main~1   # or known good SHA
bash scripts/vps-deploy/install-systemd-units.sh
```

Re-run deploy from CI preferred over manual reset when possible.

---

## 3. Roll back database (tenant data only)

**Fast reset between integration runs (local/staging dev):**

```bash
pnpm run db:test-reset   # TRUNCATE tenant data — from repo root on staging host as app user
```

**Full re-seed:**

```bash
DATABASE_URL=... DATABASE_URL_ADMIN=... pnpm --filter @apps/api run db:seed
```

See [P7-CUSTOMER-SEED-DELTA.md](../appendices/P7-CUSTOMER-SEED-DELTA.md) for smoke vs customer fixture.

---

## 4. Restart (dependency order)

```bash
systemctl start app-tour-api
systemctl start app-tour-web
systemctl start app-tour-marketing
systemctl start app-tour-portal
```

Wait for ports per [P7-PORT-MATRIX.md](../appendices/P7-PORT-MATRIX.md).

---

## 5. Verify after rollback

```bash
export TOUR_OPS_API_URL=http://127.0.0.1:3001
pnpm run p7:staging-gate
```

If still failing → [p7-staging-triage.md](p7-staging-triage.md).

---

## References

- [p7-staging-gate.md](p7-staging-gate.md)
