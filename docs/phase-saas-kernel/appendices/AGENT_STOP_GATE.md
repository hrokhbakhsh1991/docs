# Agent Stop Gate — Kernel Design Complete

```yaml
doc_id: KERNEL_AGENT_STOP_GATE
status: ACTIVE
tip: a02b72e1
branch: booking/capacity-concurrency-cert
synced_with_origin: true
```

## Verdict

**Stabilization + Kernel design (SK0–SK4) are complete and pushed.**  
Further agent work on this train **must not** invent implementation without an Architect trigger from [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md).

## Do

| Action | Allowed? |
| ------ | -------- |
| Read / explain Kernel docs | Yes |
| Fix broken links / typos in Kernel docs | Yes (docs-only) |
| Start `IMPL-SK2.C` / `IMPL-SK3-*` / `IMPL-SK4-*` | **Only** after Architect `YES — IMPL-…` + trigger fields |
| Create empty notification/entitlement/file packages | **No** |
| Blind merge `origin/DEV` | **No** |
| Full phase gates without YES | **No** |

## Architect unlock (copy one)

```text
YES — IMPL-SK2.C
first_event: <domain event or user action>
channel: email | sms | in_app
owner: <name>
```

```text
YES — IMPL-SK3-FLAGS
flags: <comma-separated TenantFeatureFlags keys>
```

```text
YES — IMPL-SK4-OBJ
shared_policy: <ACL or lifecycle rule across blob families>
```

```text
YES — IMPL-SK4-AUDIT
streams_to_unify: <e.g. tour+settings>
```

## SoT

- Charter: [`../CHARTER.md`](../CHARTER.md) (`DESIGN_COMPLETE`)
- Backlog: [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md)
- Train ledger: [TRAIN_CLOSURE_CHECKLIST.md](./TRAIN_CLOSURE_CHECKLIST.md)

---

*If the user says «ادامه بده» without an IMPL unlock, remind them of this gate — do not speculative-code.*
