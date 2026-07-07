# P7 — Canonical port & URL matrix

```yaml
matrix_id: P7-PORT-MATRIX
pack_version: "1.6"
authority: p7-0-env-matrix.md · deploy/vps/README.md
status: LOCKED
decision: DEC-P7-010
```

> **Single source of truth** for service ports and API base URLs. When docs disagree, this file wins.

---

## Service ports (all profiles)

| Service | Package | Dev default | VPS systemd | Notes |
| ------- | ------- | ----------- | ----------- | ----- |
| API | `@apps/api` | **4000** (`apps/api/.env.local`) | **3001** (`/etc/app-tour/api.env`) | Set `PORT` explicitly — never assume |
| Admin web | `@apps/web` | 3000 | 3000 | Host header required for tenant |
| Marketing | `@apps/marketing` | 3002 | 3002 | Catalog + revalidate endpoint |
| Portal | `@apps/portal` | 3003 | 3003 | Register + `/me` BFF |

**Rule:** BFF apps use `TOUR_OPS_API_URL` pointing at the **API listen URL** for that profile (loopback on VPS: `http://127.0.0.1:3001`).

---

## Profile A — Local dev (canonical `*.localhost`)

| Variable | Value |
| -------- | ----- |
| API listen | `http://127.0.0.1:4000` (typical `.env.local`) |
| `TOUR_OPS_API_URL` (web/marketing/portal) | `http://127.0.0.1:4000` |
| Admin URL | `http://operator.admin.localhost:3000` |
| Marketing URL | `http://operator.localhost:3002` (legacy ingress `shop.operator.localhost:3002` strip-only) |
| Portal URL | `http://operator.portal.localhost:3003` |
| Dev flags | `ALLOW_DEV_WEB_SESSION=true` · `AUTH_ALLOW_DEV_STATIC_OTP=true` |

Verify: [p7-0-local-stack.md](../runbooks/p7-0-local-stack.md)

---

## Profile B — VPS IP (HTTP, no DNS)

| Variable | api.env | web.env | marketing.env | portal.env |
| -------- | ------- | ------- | ------------- | ---------- |
| `PORT` | 3001 | 3000 | 3002 | 3003 |
| `TOUR_OPS_API_URL` | — | `http://127.0.0.1:3001` | same | same |
| `PUBLIC_TENANT_FALLBACK_*` | api only | — | — | — |
| `TOUR_OPS_PUBLIC_FALLBACK_HOSTS` | — | VPS IP | VPS IP | VPS IP |
| `SESSION_COOKIE_SECURE` | — | `false` | — | `false` |

Public URLs (example IP `89.45.89.206`):

| Surface | URL |
| ------- | --- |
| Admin | `http://89.45.89.206:3000/auth/login` |
| Marketing | `http://89.45.89.206:3002/tours` |
| Portal | `http://89.45.89.206:3003` |

Host bind smoke: `TOUR_OPS_API_URL=http://89.45.89.206:3001 node scripts/smoke-p6-host-bind.mjs`

---

## Profile C — Subdomain staging (TLS)

| Surface | URL pattern |
| ------- | ----------- |
| API | `https://api.staging.example.com` (ingress → API :3001 or :4000 behind proxy) |
| Marketing | `https://operator.staging.example.com` |
| Portal | `https://operator.portal.staging.example.com` |
| Admin | `https://operator.admin.staging.example.com` |

Dev flags: **`false`** on staging (`ALLOW_DEV_WEB_SESSION` · `AUTH_ALLOW_DEV_STATIC_OTP`).

---

## Scripts default alignment

| Script | Default API URL | Override |
| ------ | --------------- | -------- |
| `scripts/p7-staging-verify.sh` | `http://127.0.0.1:4000` | `TOUR_OPS_API_URL` env |
| `scripts/smoke-p6-host-bind.mjs` | none (required env) | `TOUR_OPS_API_URL` |
| Playwright (local) | localhost hosts | see [p7-staging-e2e.md](../runbooks/p7-staging-e2e.md) |

**VPS operators:** always export `TOUR_OPS_API_URL=http://127.0.0.1:3001` (or public `:3001`) before verify scripts.

---

## References

- [p7-0-env-matrix.md](../runbooks/p7-0-env-matrix.md)
- [host-subdomain-map.md](../../phase-19/p6/runbooks/host-subdomain-map.md)
- [DEC-P7-INDEX.md](DEC-P7-INDEX.md) DEC-P7-010
