# ERIP — Phase 9 COP archive

```yaml
erip_version: "2026-06-08-v2"
authority: phase-9-agent-router.md §5
guard_check: p9_erip_cop_depth
mandatory_subphases: ["9.1", "9.2", "9.3", "9.4", "9.5"]
recommended_subphases: ["9.6", "9.7", "9.8"]
exempt_subphases: ["9.0"]
```

## COP inventory (8 files)

| Subphase | COP file                                                         | Status                               | Failure modes |
| -------- | ---------------------------------------------------------------- | ------------------------------------ | ------------- |
| **9.1**  | [`9.1-cop-identity-port.md`](9.1-cop-identity-port.md)           | DRAFT · `doc_depth: APPROVED_PARITY` | F-9.1-01..07  |
| **9.2**  | [`9.2-cop-admin-shell.md`](9.2-cop-admin-shell.md)               | DRAFT · APPROVED_PARITY              | F-9.2-01..08  |
| **9.3**  | [`9.3-cop-tours-operator.md`](9.3-cop-tours-operator.md)         | DRAFT · APPROVED_PARITY              | F-9.3-01..09  |
| **9.4**  | [`9.4-cop-users-rbac.md`](9.4-cop-users-rbac.md)                 | DRAFT · APPROVED_PARITY              | F-9.4-01..04  |
| **9.5**  | [`9.5-cop-bookings-ops.md`](9.5-cop-bookings-ops.md)             | DRAFT · APPROVED_PARITY              | F-9.5-01..03  |
| **9.6**  | [`9.6-cop-settings-templates.md`](9.6-cop-settings-templates.md) | DRAFT                                | F-9.6-01..03  |
| **9.7**  | [`9.7-cop-finance-denali.md`](9.7-cop-finance-denali.md)         | DRAFT                                | F-9.7-01..03  |
| **9.8**  | [`9.8-cop-operator-dod.md`](9.8-cop-operator-dod.md)             | DRAFT                                | F-9.8-01..04  |

## Filename convention

```text
docs/phase-9/appendices/erip/9.{n}-cop-{topic}.md
```

## Required YAML (body block)

```yaml
cop_id: COP-P9-9.x
subphase: "9.x"
status: DRAFT | APPROVED
doc_depth: APPROVED_PARITY # required for guard p9_erip_cop_depth
inv_p9_compliance: [INV-P9-007, ...]
```

## Approval gate

Merge to protected paths requires COP `status: APPROVED` + Architect ISO timestamp. Doc pack allows `DRAFT` with full failure-mode depth until implementation unlock.

## Research requirement (9.1–9.5)

COP must cite ≥1 dated enterprise source URL in front-matter or research table (9.1 exemplar).
