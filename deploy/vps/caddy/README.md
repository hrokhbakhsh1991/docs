# Caddy Reverse Proxy — Profile C (P10-1-N-001)

**Purpose:** HTTPS edge for Platform subdomain staging with wildcard TLS certificates.

## Architecture

```
Internet (HTTPS :443)
    ↓
Caddy (reverse proxy)
    ↓
Apps (loopback 127.0.0.1)
    ├─ :3000 → web (operator admin)
    ├─ :3001 → api (internal only)
    ├─ :3002 → marketing
    └─ :3003 → portal
```

## URL Patterns

| Surface        | Pattern                             | Backend         |
| -------------- | ----------------------------------- | --------------- |
| Admin          | `https://admin.{club}.{root}`       | 127.0.0.1:3000  |
| Portal         | `https://portal.{club}.{root}`      | 127.0.0.1:3003  |
| Marketing      | `https://{club}.{root}`             | 127.0.0.1:3002  |
| Production API | `https://api.{root}`                | 127.0.0.1:3001  |
| Staging API    | `https://staging-api-{club}.{root}` | 127.0.0.1:23001 |

**Example:** `https://operator.admin.staging.example.com` → `127.0.0.1:3000`

## Environment Variables

Set in `/etc/environment` or systemd service:

```bash
PLATFORM_ROOT_DOMAIN=staging.example.com
CANONICAL_TENANT_LABEL=denali
STAGING_SECOND_TENANT_LABEL=qa2
```

## Installation

### 1. Install Caddy

```bash
# Debian/Ubuntu
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 2. Deploy Caddyfile + ports from env

```bash
# Reads both stacks: production 3000–3003 and staging 23000–23003.
PROD_ENV_DIR=/etc/app-tour \
STAGING_ENV_DIR=/etc/app-tour-staging \
PLATFORM_ROOT_DOMAIN=your.staging.apex \
bash /opt/app-tour-staging/scripts/vps-deploy/install-caddy-profile-c.sh
```

Or step-by-step:

```bash
sudo cp deploy/vps/caddy/Caddyfile /etc/caddy/Caddyfile
PROD_ENV_DIR=/etc/app-tour STAGING_ENV_DIR=/etc/app-tour-staging \
PLATFORM_ROOT_DOMAIN=your.staging.apex \
  bash scripts/vps-deploy/render-caddy-env.sh
sudo systemctl restart caddy
```

**Port mapping:** `render-caddy-env.sh` reads both env directories and writes explicit `PROD_*_PORT` and `STAGING_*_PORT` values. Production domains route to `3000–3003`; staging domains route to `23000–23003`. It reads the production `PORTAL_PUBLIC_BASE_URL` (falling back to `marketing.env`) so custom production portal hosts route to the Portal upstream instead of the marketing wildcard. The site addresses are explicitly HTTP because Arvan terminates public HTTPS before the origin; `X-Forwarded-Proto` and `X-Forwarded-Host` remain set for the applications. Provisioning another workspace must update the public URL/env and reload Caddy; it does not broaden the session cookie to the platform root.

The staging Profile C keeps exact public A hosts for the current staging tenant. Legacy public QA2 names always return HTTP 503 and never proxy, so they cannot fall through to production wildcard routes. The private QA2 hosts described below proxy to staging ports only after `STAGING_SECOND_TENANT_ENABLED=true` is explicitly set in the renderer environment or staging `web.env`. Rendering fails if any staging app env file is missing, a staging port is invalid or duplicated, a staging port collides with production, or the enable flag is not exactly `true` or `false`.

### Private two-tenant staging ingress

For isolated A/B browser tests, the Caddyfile also declares these exact HTTPS hosts under the reserved `.staging.test` suffix:

| Tenant       | Admin                       | Portal                       | Marketing             |
| ------------ | --------------------------- | ---------------------------- | --------------------- |
| A (`denali`) | `admin.denali.staging.test` | `portal.denali.staging.test` | `denali.staging.test` |
| B (`qa2`)    | `admin.qa2.staging.test`    | `portal.qa2.staging.test`    | `qa2.staging.test`    |

These sites use Caddy's internal CA. They are for private test ingress: keep origin TCP/443 closed to the public internet and expose it only through an approved private runner/network path. Export only the public root certificate to an isolated test profile and trust it there; do not disable certificate validation or install the test CA into the workstation-wide trust store. Tenant B remains fail-closed with HTTP 503 until `STAGING_SECOND_TENANT_ENABLED=true`; enable it only after the tenant binding, exact host mapping, private TLS trust and origin access controls are verified. The private hostnames are not public DNS records and do not create public routes.

The private test runner must resolve the six names to the approved origin without changing the browser's URL host. Its HTTPS requests must use the default port and validate both hostname and certificate chain. Record the runner's exact mapping, CA fingerprint and staging runtime SHA in the execution ledger; remove temporary host mappings and trust material when the run ends.

### 3. Configure DNS

For wildcard TLS, you need DNS records:

```
*.staging.example.com        A    <VPS_IP>
<club>.admin.staging.example.com  A    <VPS_IP>  # legacy compatibility
<club>.portal.staging.example.com A    <VPS_IP>  # legacy compatibility
staging-api-<club>.staging.example.com A <VPS_IP>
admin.<club>.staging.example.com  A    <VPS_IP>
portal.<club>.staging.example.com A    <VPS_IP>
```

**Note:** Wildcard TLS via Let's Encrypt requires DNS-01 challenge. For HTTP-01 challenge (simpler), use individual subdomains instead.

### 4. Start Caddy

```bash
# Enable and start Caddy service
sudo systemctl enable caddy
sudo systemctl start caddy

# Check status
sudo systemctl status caddy

# View logs
sudo journalctl -u caddy -f
```

## Loopback Binding

Apps must bind to `127.0.0.1` (not `0.0.0.0`) for security:

**Before (Profile B - exposed):**

```bash
# Apps listen on all interfaces
0.0.0.0:3000-3003
```

**After (Profile C - loopback):**

```bash
# Apps listen on loopback only
127.0.0.1:3000-3003
```

### Update App Start Scripts

In `scripts/vps-deploy/start-*.sh`, ensure apps bind to loopback:

```bash
# Web
PORT=3000 HOST=127.0.0.1 node apps/web/server.js

# Marketing
PORT=3002 HOST=127.0.0.1 node apps/marketing/server.js

# Portal
PORT=3003 HOST=127.0.0.1 node apps/portal/server.js

# API
PORT=3001 HOST=127.0.0.1 node apps/api/dist/main.js
```

## Verification

### 1. Check Caddy is running

```bash
sudo systemctl status caddy
curl -I http://localhost:2019/config/  # Caddy admin API (if enabled)
```

### 2. Test loopback

```bash
# Apps should respond on loopback
curl http://127.0.0.1:3000/auth/login  # web
curl http://127.0.0.1:3001/health      # api
curl http://127.0.0.1:3002/health      # marketing
curl http://127.0.0.1:3003/health      # portal
```

### 3. Test HTTPS (after DNS configured)

```bash
# Should return 200 with HTTPS
curl -I https://operator.admin.staging.example.com/auth/login
curl -I https://operator.portal.staging.example.com/health
curl -I https://operator.staging.example.com/health
```

### 4. Verify HTTP→HTTPS redirect

```bash
# Should redirect to HTTPS
curl -I http://operator.admin.staging.example.com
# Expect: 301/302 → https://...
```

## Troubleshooting

### Caddy won't start

```bash
# Check Caddyfile syntax
caddy validate --config /etc/caddy/Caddyfile

# Check logs
sudo journalctl -u caddy -n 50
```

### TLS certificate errors

```bash
# Inspect Caddy logs and certificate storage without trusting the private CA globally
sudo journalctl -u caddy -n 100 --no-pager
sudo find /var/lib/caddy -type f -name '*.crt' -print
```

For `.staging.test`, trust Caddy's public internal-CA root only inside the isolated test runner/profile. Never use `curl -k`, browser certificate-error bypasses, or workstation-wide `caddy trust` for this private staging CA.

### Apps not responding

```bash
# Check apps are running on loopback
ss -tlnp | grep '127.0.0.1:300[0-3]'

# Check systemd services
sudo systemctl status app-tour-{api,web,marketing,portal}
```

### DNS not resolving

```bash
# Check DNS records
dig operator.admin.staging.example.com
dig operator.portal.staging.example.com
dig operator.staging.example.com
```

## Profile B Compatibility

Profile B (IP HTTP) remains supported:

```
http://<VPS_IP>:3000  # web
http://<VPS_IP>:3002  # marketing
http://<VPS_IP>:3003  # portal
```

**Note:** Profile B and Profile C can coexist. Apps listen on loopback, but Caddy can proxy to them while direct IP access still works if firewall allows.

## Security Notes

1. **Loopback only:** Apps should NOT be accessible from `0.0.0.0` in production
2. **Firewall:** Block direct access to ports 3000-3003. For private `.staging.test` ingress, keep origin 443 closed publicly; do not apply a broad `ufw allow 443/tcp` rule.
3. **Headers:** Caddy forwards `X-Forwarded-Proto`, `X-Forwarded-Host` for session security
4. **TLS:** Public Arvan routes terminate TLS at the edge; private `.staging.test` routes use Caddy's internal CA and isolated runner trust.

## References

- [Caddyfile](./Caddyfile)
- [P10-1-N-001 verification](../../docs/phase-23/appendices/P10-VERIFICATION-COMMANDS.yaml)
- [p10-app-fit.md](../../docs/phase-23/p10-app-fit.md)
- [p10-production-profile.yaml](../../docs/phase-23/p10-production-profile.yaml)
