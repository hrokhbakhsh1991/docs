# P9 — Execution discipline

```yaml
discipline_id: P9-EXECUTION-DISCIPLINE
pack_version: "1.0"
status: NORMATIVE
```

> **Rule:** Consolidate **code paths** — not product features · not infra (P10).

---

## Execution order

```text
1. Wave A — packages + delete web duplicate BFF + orphan flow
2. Wave B — catalog bootstrap cut + portal modules + guard
3. Wave C — doc/e2e + p9:gate
```

**Blocked until:** `pnpm run p8:gate` green (cookie rename · portal middleware).

---

## Doc-first

| Touch | Required |
| ----- | -------- |
| `apps/api` | `docs/phase-22/` or phase-21 if ingress overlap |
| New `packages/*` | markdoc in docs + p9-package-boundary.yaml |

---

## Forbidden

```text
❌ Start P9 before P8 Wave A+B
❌ guest-surface-host in web
❌ session-client in marketing
❌ Remove web /catalog redirect pages
❌ Remove web operator resolve-host-tenant.ts
❌ TLS · Caddy · tenant_domains (P10)
❌ Zero web public-auth but keep duplicate JWT files un migrated
❌ Cross-app public-auth BFF factory
❌ Claim consolidation from redirect shims alone
```

---

## Wave A blockers (no skip)

| Nano | Why |
| ---- | --- |
| P9-0-N-001 | M+P single bootstrap source |
| P9-1-N-001 | web duplicate guest BFF security debt |
| P9-0-N-002 | session dedup after P8 cookie names |

---

## References

- [p9-app-fit.md](../p9-app-fit.md)
- [../../POST-P7-PACK-ALIGNMENT.md](../../POST-P7-PACK-ALIGNMENT.md)
