# IP Trust Model

## Security objective

Client IP based controls (rate limiting, webhook IP allowlists, abuse detection) must not trust arbitrary forwarding headers from the internet.

## Trusted proxy boundary

- `X-Forwarded-For` is used only when the direct peer IP is in `TRUSTED_PROXY_CIDRS`.
- `TRUSTED_PROXY_CIDRS` is a comma-separated list of CIDRs/IPs for reverse proxies we operate or explicitly trust.
- If `TRUSTED_PROXY_CIDRS` is empty, forwarding headers are ignored.

## Resolution algorithm

- Resolve direct peer IP from socket remote address (fallback to `req.ip` when needed).
- If direct peer is not trusted, return direct peer IP and ignore `X-Forwarded-For`.
- If direct peer is trusted:
  - Parse and validate `X-Forwarded-For` as a chain of literal IPs.
  - On malformed values, ignore the header and fall back to direct peer IP.
  - Walk right-to-left across `X-Forwarded-For + remoteIp` and return the first untrusted hop as client IP.

## Enforcement points

- Public registration throttling tracker.
- Tenant abuse/rate-limit service.
- Request context `clientIp`.
- Payments webhook IP allowlist guard.
- Tenant usage metering quota logs.

## Operational notes

- Keep `TRUST_PROXY_HOPS` and `TRUSTED_PROXY_CIDRS` aligned with deployed ingress topology.
- Any direct internet path to API nodes should not appear in `TRUSTED_PROXY_CIDRS`.
