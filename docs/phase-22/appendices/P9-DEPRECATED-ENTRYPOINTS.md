# P9 — Deprecated entrypoints

```yaml
doc_id: P9-DEPRECATED-ENTRYPOINTS
sole_entry: docs/phase-22/AGENT-START.md
fail_token: P9_FAIL
```

| Path / action | Use instead |
| ------------- | ----------- |
| `p9-code-consolidation-audit.md` alone | BOOT-MANIFEST + VERIFICATION-COMMANDS |
| `platform-code-consolidation.mdoc` alone | AGENT-START T0 |
| Bulk gap registry read | current nano only |
| Implement P10 TLS in P9 | P10 pack |
| Remove all web `/catalog` | Keep redirect shims |
| Zero `resolve-host-tenant` in web | Operator map stays |

Boot deprecated path → `hollow_risk: flagged`.
