# Tenant Resolution Caching

This service resolves workspace tenant context from inbound hostnames (`{subdomain}.{TENANT_ROOT_DOMAIN}`) with a strict host trust model.

## Host trust model

Configuration:

- `TRUST_PROXY` (`true` / `false`)
- `TRUSTED_PROXY_CIDRS` (optional CIDR/IP list)
- `TENANT_ROOT_DOMAIN` (base domain)

Rules:

1. `TRUST_PROXY=false`
   - `x-forwarded-host` is ignored.
   - resolver uses direct request host only.
2. `TRUST_PROXY=true`
   - `x-forwarded-host` is used only when remote peer IP is trusted.
   - `TRUSTED_PROXY_CIDRS` must be configured; empty CIDRs disables forwarded-host trust (fail-closed).
   - remote IP must match one configured CIDR/IP.
   - otherwise falls back to direct request host.

This prevents host spoofing from untrusted clients.

## Host parsing

Tenant label extraction uses a pure rule:

- host must equal base domain (apex, no tenant) or end with `.${baseDomain}`
- multi-label prefix is rejected (for example `foo.example.com.evil.com` is rejected)
- comparison is case-insensitive

Examples:

- `foo.example.com` + base `example.com` => tenant label `foo`
- `example.com` + base `example.com` => no tenant label
- `foo.example.com.evil.com` + base `example.com` => rejected

## Redis cache layer

`TenantHostResolverService` now uses Redis to cache hostname-to-tenant mappings:

- key: `tenant_host:{hostname}`
- value: `tenant_id`
- TTL: `60` seconds

Cache flow:

1. Normalize + validate hostname (`normalizeInboundHostname`).
2. Parse workspace label (`parseWorkspaceTenantLabel`).
3. Lookup Redis cache.
4. On miss, query `tenants` table and populate cache.

Only validated hostnames are used as cache keys, which prevents cache poisoning via malformed input.

## Invalidation

Cache invalidation is automatic when tenant routing identity changes:

- tenant subdomain updates
- tenant soft delete

`TenantHostCacheInvalidationSubscriber` listens to `TenantEntity` updates/removals and invalidates relevant cache keys.

## Metrics

Prometheus counters exposed via internal ops metrics:

- `tenant_resolver_cache_hits`
- `tenant_resolver_cache_misses`

These counters are also included in the security metrics JSON snapshot for operations dashboards.

## Reverse proxy configuration

- Ensure edge/ingress rewrites `Host` consistently and forwards only trusted `x-forwarded-host`.
- Set `TRUST_PROXY=true` only behind known proxies.
- Set `TRUSTED_PROXY_CIDRS` to ingress/load-balancer source ranges in production (required to trust `x-forwarded-host`).
- Keep `TENANT_ROOT_DOMAIN` aligned with public DNS zone (for example `app.example.com`).

Example:

- `TRUST_PROXY=true`
- `TRUSTED_PROXY_CIDRS=10.0.0.0/8,192.168.0.0/16`
- request from `10.0.1.15` with `x-forwarded-host: acme.example.com` => forwarded host accepted
- request from public IP with same header => header ignored, direct host used
