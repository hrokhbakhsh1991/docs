# Audit (host)

```yaml
surface: apps/api/src/audit
kernel_design: docs/phase-saas-kernel/appendices/SK4_AUDIT_FILE.md
```

## What this folder is

Tour-centric forensic audit helpers (`audit-logger`, actor pseudonym) written in the same DB transaction as tour mutations where required.

## Sibling audit streams (not in this folder)

| Stream | Where |
| ------ | ----- |
| Settings | `apps/api/src/settings/*audit*` |
| Platform ops list/export | `routes/platform/audit-*` |
| Outbox replay runs | `outbox/outbox-replay-audit.ts` |

Do not silently funnel all of these into one API without an SK4.C extraction PR.
