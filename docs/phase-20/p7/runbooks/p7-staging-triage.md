# P7 — Staging failure triage (VS-01..08)

```yaml
runbook_id: P7-STAGING-TRIAGE
authority: p7-staging-e2e.md · SMOKE-SCENARIO-MAP-P7.md
carryover: ../../phase-19/p6/runbooks/p6-e2e-smoke.md
```

> Staging-specific triage. Localhost triage remains in p6-e2e-smoke §Failure triage.

---

## VS quick map

| VS | Symptom on staging | First checks |
| -- | ------------------ | ------------ |
| VS-01 | Publish fails / draft in catalog | wizard walkthrough · Postgres `STORAGE_DRIVER=prisma` |
| VS-02 | Catalog empty / stale after publish | `MARKETING_REVALIDATE_*` · [p7-receipt-minio-staging.md](p7-receipt-minio-staging.md) N/A · BLK-CAT-01 |
| VS-03 | Portal register fails | [p7-sms-otp-staging.md](p7-sms-otp-staging.md) · BFF · API up |
| VS-04 | `/me` empty | session cookie · `GET /bookings?view=mine` |
| VS-05 | Receipt upload fails | [p7-receipt-minio-staging.md](p7-receipt-minio-staging.md) MinIO |
| VS-06 | Approve booking fails | `PLAYWRIGHT_BASE_URL` admin host · fa-IR status |
| VS-07 | Receipt approve fails | T3 `finance-ops` · Postgres not memory |
| VS-08 | Gate red | `pnpm run p7:gate` locally first |

---

## Infra (all VS)

| Symptom | Check | Doc |
| ------- | ----- | --- |
| Wrong tenant | host header / fallback | [P7-HOST-PARITY-PROFILE-B.md](../appendices/P7-HOST-PARITY-PROFILE-B.md) |
| API connection refused | `PORT` 3001 vs 4000 | [P7-PORT-MATRIX.md](../appendices/P7-PORT-MATRIX.md) |
| Four-process down | systemd status | [p7-staging-rollback.md](p7-staging-rollback.md) |
| Playwright boots localhost | `PW_EXTERNAL_SERVERS=1` | [p7-staging-e2e.md](p7-staging-e2e.md) |

```bash
systemctl status app-tour-api app-tour-web app-tour-marketing app-tour-portal
journalctl -u app-tour-api -n 100 --no-pager
export TOUR_OPS_API_URL=http://127.0.0.1:3001
curl -fsS "$TOUR_OPS_API_URL/health"
```

---

## Profile B (raw IP)

| Symptom | Check |
| ------- | ----- |
| `tenant-context` 404 | `PUBLIC_TENANT_FALLBACK_LABEL` + `PUBLIC_TENANT_FALLBACK_HOSTS` on API |
| Marketing wrong club | `TOUR_OPS_PUBLIC_FALLBACK_HOSTS` on marketing.env |
| CTA wrong portal URL | `PORTAL_PUBLIC_BASE_URL` on marketing |

---

## Profile C (subdomain)

| Symptom | Check |
| ------- | ----- |
| TLS / redirect loop | ingress `x-forwarded-host` |
| OTP never arrives | [p7-sms-otp-staging.md](p7-sms-otp-staging.md) Profile C waiver |
| Dev session leaked | `ALLOW_DEV_WEB_SESSION=false` |

---

## Gate failures

| Command | Fix path |
| ------- | -------- |
| `p7:gate` | fix P6 regression first — stop P7 product work |
| `p7:staging-gate` host skip | start API · set `TOUR_OPS_API_URL` |
| `finance-ops` | `DATABASE_URL` · migrations · `STORAGE_DRIVER=prisma` |

---

## References

- [IMPLEMENTATION-TRUTH-P7.md](../appendices/IMPLEMENTATION-TRUTH-P7.md)
