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

