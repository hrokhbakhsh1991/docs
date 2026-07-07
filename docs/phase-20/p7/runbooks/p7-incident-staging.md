# P7 — Staging incident runbook

```yaml
runbook_id: P7-STAGING-INCIDENT
pack_version: "1.6"
severity: [SEV-1, SEV-2, SEV-3]
authority: p7-staging-triage.md · p7-staging-rollback.md
```

---

## Severity

| Level | Definition | Response |
| ----- | ---------- | -------- |
| **SEV-1** | Staging down · no operator login · data loss risk | Immediate rollback |
| **SEV-2** | One surface down (marketing/portal) · VS blocked | Fix forward or rollback unit |
| **SEV-3** | Degraded (catalog stale · OTP flaky) | Triage doc · next business day |

---

## SEV-1 — Full stack down

1. `systemctl status app-tour-*`
2. `journalctl -u app-tour-api -n 100 --no-pager`
3. [p7-staging-rollback.md](p7-staging-rollback.md) §1–5
4. Notify Architect · log incident in evidence pack `incident.log`

---

## SEV-2 — Single process

```bash
systemctl restart app-tour-marketing   # example
journalctl -u app-tour-marketing -n 50 --no-pager
curl -fsS http://127.0.0.1:3002/health
```

If repeat failure → rollback deploy SHA.

---

## SEV-3 — Common incidents

| Incident | Runbook |
| -------- | ------- |
| Catalog stale after publish | [p7-staging-triage.md](p7-staging-triage.md) VS-02 · `MARKETING_REVALIDATE_*` |
| OTP flood / rate limit | [p7-sms-otp-staging.md](p7-sms-otp-staging.md) · `OTP_RATE_LIMITED` |
| Finance T3 fail | [p7-receipt-minio-staging.md](p7-receipt-minio-staging.md) |
| Wrong tenant on IP | [P7-HOST-PARITY-PROFILE-B.md](../appendices/P7-HOST-PARITY-PROFILE-B.md) |

---

## Post-incident

1. Root cause in `IMPLEMENTATION-TRUTH-P7` proof log
2. Update triage table if new pattern
3. Re-run `pnpm run p7:staging-gate` before closing

---

## Escalation

| Role | When |
| ---- | ---- |
| Operator | SEV-3 first response |
| Architect | SEV-1/2 · any data question |
| Customer comms | SEV-1 only · via agreed channel |

---

## References

- [P7-EVIDENCE-PACK.md](../appendices/P7-EVIDENCE-PACK.md)
