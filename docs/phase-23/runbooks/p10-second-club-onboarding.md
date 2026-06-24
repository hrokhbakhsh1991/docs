# P10 — Second club onboarding (platform subdomain)

```yaml
runbook_id: P10-SECOND-CLUB-ONBOARDING
pack: P10
nano: P10-0-N-003
gap: G-DOM-04
status: ACTIVE
proof_tier: OPS
```

> **Exit proof:** Staging onboarding of `alborz.*` on platform subdomain — **no live second production customer required**.

---

## Preconditions

- Wildcard staging TLS green ([P10-1-N-001](../appendices/P10-VERIFICATION-COMMANDS.yaml)) **or** Profile B IP smoke for interim proof
- `smoke-four-process.sh` green on target env
- **Forbidden in this runbook:** `PUBLIC_TENANT_FALLBACK_HOSTS` as sole routing · raw `:3002` IP-only URLs as exit proof

---

## Staging VPS quick reference

| Resource | Path / port |
| -------- | ----------- |
| Deploy | `/opt/app-tour-staging` |
| Env | `/etc/app-tour-staging/` |
| Units | `app-tour-staging-*` |
| Ports | api `23001` · web `23000` · mkt `23002` · ptl `23003` |

```bash
ENV_DIR=/etc/app-tour-staging bash /opt/app-tour-staging/scripts/vps-deploy/smoke-four-process.sh
```

---

## Steps (staging example: club `alborz`)

### 1. Tenant + workspace

Create tenant `alborz` + Denali workspace via operator admin (existing P6/P7 flow).

### 2. DNS (Profile C)

Wildcard already covers (replace `staging.example.com` with your apex):

- `alborz.staging.example.com` → marketing
- `alborz.portal.staging.example.com` → portal
- `alborz.admin.staging.example.com` → operator web

### 3. Host verification

**Profile C (HTTPS):**

```bash
curl -I "https://alborz.admin.${PLATFORM_ROOT_DOMAIN}/auth/login"
curl -I "https://alborz.portal.${PLATFORM_ROOT_DOMAIN}/health"
curl -I "https://alborz.${PLATFORM_ROOT_DOMAIN}/health"
```

**Profile B interim (IP — not exit proof alone):**

```bash
curl -I "http://89.45.89.206:23000/auth/login" -H "Host: alborz.admin.localhost"
```

### 4. Gates

```bash
# on VPS
ENV_DIR=/etc/app-tour-staging TOUR_OPS_API_URL=http://127.0.0.1:23001 P7_FAST=1 \
  bash /opt/app-tour-staging/scripts/p7-staging-verify.sh

# from laptop
VPS_HOST=89.45.89.206 pnpm run p10:staging-remote-smoke
```

### 5. Sign-off

Record in TEMP or phase-23 evidence: tenant id · hosts tested · smoke tokens · date.

---

## Out of scope

- Admin custom apex `admin.{customer_apex}` (trunk v2)
- Custom M+P apex HTTPS — [P10-0-N-001](../appendices/P10-VERIFICATION-COMMANDS.yaml)

---

## References

- [p10-app-fit.md](../p10-app-fit.md)
- [P7-PORT-MATRIX Profile C](../../phase-20/p7/appendices/P7-PORT-MATRIX.md)
- [p6-staging-vps-boundary.md](../../phase-19/p6/runbooks/p6-staging-vps-boundary.md)
