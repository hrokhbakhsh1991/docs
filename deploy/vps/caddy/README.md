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

| Surface | Pattern | Backend |
|---------|---------|---------|
| Admin | `https://{club}.admin.{root}` | 127.0.0.1:3000 |
| Portal | `https://{club}.portal.{root}` | 127.0.0.1:3003 |
| Marketing | `https://{club}.{root}` | 127.0.0.1:3002 |
| API | Internal only | 127.0.0.1:3001 |

**Example:** `https://operator.admin.staging.example.com` → `127.0.0.1:3000`

## Environment Variables

Set in `/etc/environment` or systemd service:

```bash
PLATFORM_ROOT_DOMAIN=staging.example.com
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
# Reads PORT from /etc/app-tour-staging/*.env (e.g. 23000–23003)
ENV_DIR=/etc/app-tour-staging \
PLATFORM_ROOT_DOMAIN=your.staging.apex \
bash /opt/app-tour-staging/scripts/vps-deploy/install-caddy-profile-c.sh
```

Or step-by-step:

```bash
sudo cp deploy/vps/caddy/Caddyfile /etc/caddy/Caddyfile
ENV_DIR=/etc/app-tour-staging PLATFORM_ROOT_DOMAIN=your.staging.apex \
  bash scripts/vps-deploy/render-caddy-env.sh
sudo systemctl restart caddy
```

**Staging ports:** `render-caddy-env.sh` reads `PORT=` from each app env file — production `3000–3003`, staging `23000–23003`.

### 3. Configure DNS

For wildcard TLS, you need DNS records:

```
*.staging.example.com        A    <VPS_IP>
*.admin.staging.example.com  A    <VPS_IP>
*.portal.staging.example.com A    <VPS_IP>
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
# Check Caddy can reach Let's Encrypt
sudo caddy trust

# View certificate status
sudo caddy list-certificates
```

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
2. **Firewall:** Use UFW to block direct access to ports 3000-3003 from internet
3. **Headers:** Caddy forwards `X-Forwarded-Proto`, `X-Forwarded-Host` for session security
4. **TLS:** Let's Encrypt provides free certificates with auto-renewal

## References

- [Caddyfile](./Caddyfile)
- [P10-1-N-001 verification](../../docs/phase-23/appendices/P10-VERIFICATION-COMMANDS.yaml)
- [p10-app-fit.md](../../docs/phase-23/p10-app-fit.md)
- [p10-production-profile.yaml](../../docs/phase-23/p10-production-profile.yaml)
