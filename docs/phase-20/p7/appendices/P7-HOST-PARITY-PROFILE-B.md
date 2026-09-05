# P7 — Host parity Profile B (raw IP, no DNS)

```yaml
appendix_id: P7-HOST-PARITY-PROFILE-B
pack_version: "1.6"
decision: DEC-P7-012
authority: P7-PORT-MATRIX.md · p6-host-tenant-parity.spec.ts
```

> How **marketing · portal · admin** resolve the same `tenantId` when users hit `http://VPS_IP:3002` etc. without subdomain DNS.

---

## Mechanism

```text
Browser → Next app (marketing|portal|web)
       → BFF/API with Host or fallback header
       → GET /public/tenant-context
       → tenantId
```

API resolves tenant from:

1. **Subdomain** on `Host` / `x-forwarded-host` (Profile C), **or**
2. **`PUBLIC_TENANT_FALLBACK_*`** on API when host is bare IP (Profile B)

---

## Required env (Profile B)

### API — `/etc/app-tour/api.env`

```bash
PUBLIC_TENANT_FALLBACK_LABEL=denali
PUBLIC_TENANT_FALLBACK_HOSTS=89.42.210.252,127.0.0.1
```

Maps bare IP requests to workspace label `denali` → tenant `00000000-0000-4000-8000-000000000003` on Denali staging VPS.

### BFF apps — marketing.env · portal.env · web.env

```bash
TOUR_OPS_API_URL=http://127.0.0.1:3001
TOUR_OPS_PUBLIC_FALLBACK_HOSTS=89.42.210.252
```

Marketing catalog fetch and portal BFF must forward a host the API can resolve.

---

## Verify

```bash
export VPS_IP=89.42.210.252
export TOUR_OPS_API_URL=http://${VPS_IP}:3001

# API host bind (same tenantId contract)
TOUR_OPS_API_URL="$TOUR_OPS_API_URL" node scripts/smoke-p6-host-bind.mjs

# Manual
curl -s -H "x-forwarded-host: ${VPS_IP}" "$TOUR_OPS_API_URL/public/tenant-context" | jq .data.tenantId
```

Playwright Profile B uses IP base URLs — see [p7-staging-e2e.md](../runbooks/p7-staging-e2e.md).

---

## Customer fixture on Profile B

When moving from smoke `operator` to customer club:

1. Update `PUBLIC_TENANT_FALLBACK_LABEL` to customer subdomain label **or** provision DNS (Profile C)
2. Re-seed per [P7-CUSTOMER-SEED-DELTA.md](P7-CUSTOMER-SEED-DELTA.md)
3. Re-run host bind smoke

---

## References

- [host-subdomain-map.md](../../phase-19/p6/runbooks/host-subdomain-map.md)
- [p7-staging-triage.md](../runbooks/p7-staging-triage.md)
