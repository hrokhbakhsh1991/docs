# P5-E — Registrations & Finance · Nano-Task Spec (AI v2.9)

```yaml
doc_id: P5-E-REG-FIN
version: 2.9-ai-friendly
nano_tasks: 6
optional: true
doc_first: docs/phase-18/platform-registrations-finance-tranche.mdoc
quality_target: 9.9+/10
```

## Scope boundary

Port **minimal** legacy slices — not full registration admin UI.

| Capability | Assert |
|------------|--------|
| Seat capacity | REG-01..02 |
| Public throttle | REG-03 |
| Paid tour OPEN gate | FIN-01 |
| Tour-created finance hook | FIN-02 |

**Must not break:** PC-06 · PC-07

---

### P5-E-N-001 [DOC] — mdoc scope + legacy refs

### P5-E-N-002 [IMPLEMENT] — RegistrationCapacityService REG-01..02

### P5-E-N-003 [IMPLEMENT] — public registration throttle REG-03

### P5-E-N-004 [TEST] — paid tour open FIN-01 (offline_receipt path)

### P5-E-N-005 [IMPLEMENT] — tour-created finance outbox FIN-02

### P5-E-N-006 [TEST] — EX-E full P5 exit path B
