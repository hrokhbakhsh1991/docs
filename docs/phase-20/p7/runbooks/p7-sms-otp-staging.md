# P7 — SMS / OTP on staging

```yaml
runbook_id: P7-SMS-OTP-STAGING
nano: P7-0-N-005 · P7-3 VS-03
authority: p7-0-env-matrix.md · apps/api/src/identity/otp-delivery.ts
profiles: [B, C]
```

> **Code truth:** `deliverOtpCode` logs to API when no provider is wired — it does **not** send SMS today unless a provider integration is added. Plan profiles accordingly.

---

## Profile matrix

| Profile | `AUTH_ALLOW_DEV_STATIC_OTP` | `OTP_FIXTURE_CODE` | Portal OTP |
| ------- | --------------------------- | ------------------ | ---------- |
| **A** local | `true` | optional | `1234` static |
| **B** VPS IP | `true` (until SMS) | optional non-prod | static or log |
| **C** subdomain | **`false`** | **forbidden** | real delivery required |

Production guard: `auth-env.ts` rejects `AUTH_ALLOW_DEV_STATIC_OTP=true` when `NODE_ENV=production` **and** profile is treated as production — use Profile B flags carefully.

---

## Profile B — recommended until SMS wired

`/etc/app-tour/api.env`:

```bash
NODE_ENV=production
# Staging-only bypass (remove before customer Profile C)
AUTH_ALLOW_DEV_STATIC_OTP=true
OPERATOR_OWNER_MOBILE=09174070937
```

Portal register test mobile must be whitelisted in tenant config (seed).

**Verify operator login:**

```bash
bash scripts/vps-deploy/smoke-operator-login.sh
```

**Verify portal:** use dev OTP `1234` when static bypass enabled — [p7-staging-e2e.md](p7-staging-e2e.md) Profile B block.

**OTP in logs (no static bypass):** API logs `otp-dev delivery` with `{ mobile, code }` — grep:

```bash
journalctl -u app-tour-api -n 200 --no-pager | grep otp-dev
```

---

## Profile C — production-like (sign-off target)

Required:

```bash
AUTH_ALLOW_DEV_STATIC_OTP=false
# OTP_FIXTURE_CODE must NOT be set in production
ALLOW_DEV_WEB_SESSION=false
```

**Provider:** trunk `otp-delivery.ts` checks `RESEND_API_KEY` — integration is stub today. Before Profile C sign-off either:

1. Wire SMS provider in `deliverOtpCode` and document env here, **or**
2. Record T4 waiver in [p7-customer-sign-off.md](p7-customer-sign-off.md) §Known exceptions with Architect approval.

---

## Rate limit

| Code | Meaning |
| ---- | ------- |
| `OTP_RATE_LIMITED` | >10 requests/min per key — wait 60s |

Spec: `apps/api/test/identity-otp-production.spec.ts`

---

## Failure triage

| Symptom | Check |
| ------- | ----- |
| `OTP_INVALID` on Profile B | `AUTH_ALLOW_DEV_STATIC_OTP` · mobile whitelist |
| No SMS Profile C | provider not implemented — use waiver or Profile B for interim |
| Operator login fails | `OPERATOR_OWNER_MOBILE` · seed owner row |
| Portal OTP never arrives | API logs · rate limit · `public-auth` BFF |

---

## References

- [p7-staging-triage.md](p7-staging-triage.md)
- [first-customer-seed.md](../../phase-19/p6/runbooks/first-customer-seed.md)
