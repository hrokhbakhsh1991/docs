# Booking HTTP→Postgres Call Graph Consolidation

```yaml
doc_id: BOOKING_HTTP_CALLGRAPH_CONSOLIDATION
status: ACTIVE
date: "2026-07-20"
```

## Rule

One business rule → one implementation. Guest duplicate detection and capacity policy context construction were duplicated across create/approve and four guest-match methods; consolidated without changing HTTP/DB outcomes.
