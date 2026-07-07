# P7 — Deprecated entrypoints (agents)

```yaml
deprecated_id: P7-DEPRECATED-ENTRYPOINTS
pack_version: "1.6"
fail_token: P7_FAIL
sole_entry: appendices/P7-BOOT-MANIFEST.yaml
```

> **T0 rule:** Boot from [P7-BOOT-MANIFEST.yaml](P7-BOOT-MANIFEST.yaml) only. Loading a file below as **sole entry** → `P7_FAIL`.

---

## Forbidden as sole boot

| Path | Use instead |
| ---- | ----------- |
| [AGENT-CONTEXT.md](../AGENT-CONTEXT.md) | [AGENT-START.md](../AGENT-START.md) + BOOT-MANIFEST |
| [platform-denali-customer-delivery.mdoc](../platform-denali-customer-delivery.mdoc) | Navigator + current EPIC spec |
| [TRACEABILITY-MATRIX-P7.md](TRACEABILITY-MATRIX-P7.md) alone | VERIFICATION-COMMANDS.yaml for current nano |
| [p7-exit-checklist.md](../p7-exit-checklist.md) alone | AGENT-CURRENT-PHASE.yaml + truth ledger |
| `docs/phase-19/p6/*` for P7 implementation | P6 regression only · `pnpm run p6:gate` |

---

## T2 lookup only (not execution boot)

| Path | Role |
| ---- | ---- |
| [P7-DOC-ARCHITECTURE.md](P7-DOC-ARCHITECTURE.md) | Meta / C4 |
| [POST-P7-HORIZON.md](POST-P7-HORIZON.md) | Z4 after sign-off |
| [PACK-EXTENSION-GUIDE.md](PACK-EXTENSION-GUIDE.md) | Adding nanos |

---

## Superseded patterns

| Old pattern | Replacement |
| ----------- | ----------- |
| `staging manual` in nano verify | `P7-VERIFICATION-COMMANDS.yaml` + `manual_runbook_ref` |
| `done_doc` progress metric | `nano_staging_done` + evidence pack |
| Claim P7 complete from `p7:gate` alone | [P7-ANTI-HOLLOW-CONTRACT.md](P7-ANTI-HOLLOW-CONTRACT.md) |

---

## References

- [DEC-P7-015](DEC-P7-INDEX.md) — BOOT-MANIFEST sole T0 entry
