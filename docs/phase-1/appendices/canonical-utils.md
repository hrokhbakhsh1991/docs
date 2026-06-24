# Appendix B — Canonical utils

### Appendix B — canonical-path / canonical-value (internal)

```yaml
internal_utils_not_on_barrel:
  canonical_path:
    file: packages/platform-core/src/utils/canonical-path.ts
    fn: getCanonicalValue(data, path)
  canonical_value:
    file: packages/platform-core/src/utils/canonical-value.ts
    fns: [isEmptyCanonicalValue, assertCanonicalValueMatchesKind]
  consumers: [validateCanonical, test/unit/utils/*.spec.ts]
  rule: "NEVER export from index.ts"
```

### Composite kind (Phase 11.10)

`assertCanonicalValueMatchesKind` treats `kind: "composite"` as accepting both plain objects (widget bodies) and JSON arrays at canonical paths where workspace ingress stores lists (`program.themeIds`, `leaderUserIds`, `photos`, etc.). `isEmptyCanonicalValue` treats an empty array as empty for composite kind. See `docs/phase-11/canonical-array-ingress.md` (INV-DENALI-INGRESS-001).

