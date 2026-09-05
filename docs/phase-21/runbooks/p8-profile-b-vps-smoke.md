# P8 — Profile B VPS smoke (raw IP)

> **Profile B:** `http://89.42.210.252:23000–23003` without DNS. Requires P8 code on VPS + `PUBLIC_TENANT_FALLBACK_*` in staging `api.env`.

---

## Prereqs

| Item | Staging path |
| ---- | ------------ |
| Deploy | `/opt/app-tour-staging` |
| Env | `/etc/app-tour-staging/` |
| Units | `app-tour-staging-{api,web,marketing,portal}` |
| Ports | 23001 · 23000 · 23002 · 23003 |

`api.env` must include:

```bash
PUBLIC_TENANT_FALLBACK_LABEL=denali
PUBLIC_TENANT_FALLBACK_HOSTS=89.42.210.252,127.0.0.1
```

`bootstrap-staging.sh` appends these when missing. **Restart API** after env or code change.

---

## Commands

### From laptop (SSH + external curl)

```bash
bash scripts/p8-staging-remote-smoke.sh
```

Expect: `P8_STAGING_REMOTE_SMOKE_OK` · `P8_PROFILE_B_SMOKE_OK`

### On VPS loopback only

```bash
P8_PROFILE_B_HOST=89.42.210.252 TOUR_OPS_API_URL=http://127.0.0.1:23001 node scripts/smoke-p8-profile-b.mjs
```

### After cookie rename deploy

Users must **log in again** on `:23000` (operator) and `:23003` (member) — old `session` cookies are ignored.

---

## Triage

| Symptom | Fix |
| ------- | --- |
| `TENANT_HOST_UNKNOWN` on IP | Deploy P8 API (`resolve-public-ingress-subdomain` IP fallback) + restart `app-tour-staging-api` |
| `verify-env-coherence --all` fail | Align `TOUR_OPS_API_URL` ports across four env files |
| Marketing/portal 500 prod | Set `AUTH_JWT_PUBLIC_KEY` on BFF env (G-ENV-04) |

---

## References

- [platform-surface-hardening.mdoc](../platform-surface-hardening.mdoc)
- [P7-HOST-PARITY-PROFILE-B.md](../../phase-20/p7/appendices/P7-HOST-PARITY-PROFILE-B.md)
- [p8-env-contract.yaml](../p8-env-contract.yaml)
