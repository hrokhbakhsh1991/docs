# Appendix A — Error codes

### Appendix A — Standard platform-core error codes

```yaml
error_codes_excerpt:
  source: packages/platform-core/src/errors/platform-core.error.ts
  codes_include:
    - UNKNOWN_FIELD_ID
    - DUPLICATE_FIELD_ID
    - INVALID_RULE_SET
    - HIDDEN_FIELD_POISON
    - UNKNOWN_CANONICAL_PATH
    - REQUIRED_FIELD_EMPTY
    - REGISTRY_CARDINALITY_VIOLATION
    - AMBIGUOUS_RULE_RESOLUTION
    - INVALID_RULE_CONTEXT
    - PLUGIN_INVALID_SHAPE
    - CANONICAL_TYPE_MISMATCH
  ingress_mapping: packages/platform-core/src/errors/ingress-sanitization-map.ts
```

