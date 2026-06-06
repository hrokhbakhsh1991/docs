# Soft delete deferred to Phase 6 (DEC-105 / CAE-GAP-01/02)

```yaml
status: deferred
phase: 6
closes: none in Phase 5 evolution
related: phase5-evolution-audit.md — soft_delete_exists=no
```

## Decision

Canonical tour **hard delete** + append-only audit remains in Phase 5. Tombstone / `deleted_at` columns and canonical history table are **Phase 6** scope — requires schema migration, RLS policy update, and projection reconcile changes.

Operators: use FK RESTRICT + append-only audit for forensic recovery; PITR for catastrophic admin errors.
