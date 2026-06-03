# app-tour documentation (Docs-as-Code)

Architecture documentation lives in this directory and is **gated** like application code.

## Layout

| Path | Purpose |
|------|---------|
| [`MIGRATION-MAP.md`](MIGRATION-MAP.md) | North Star, phase DAG, Phase Gate Audit Table |
| [`phase-registry.json`](phase-registry.json) | Machine-readable phase index (CI-validated) |
| [`DOCUMENTATION-DEBT-REGISTRY.md`](DOCUMENTATION-DEBT-REGISTRY.md) | Phases 0–2 doc retrofit tracker |
| [`phase-*.md`](phase-0-foundation.md) | Per-phase execution guides |
| [`phases/README.md`](phases/README.md) | Phase index |
| [`markdoc/`](markdoc/config.mjs) | Markdoc schema for structured audits |
| [`audits/`](audits/README.md) | Forensic audit archive |

## Commands

```bash
pnpm run doc-gate                  # full Doc-Gate (required before Phase 3.1 merge)
pnpm run guard:documentation-sync  # registry + link validation
pnpm run doc:markdoc:validate      # parse docs/**/*.mdoc
pnpm run audit-boundary            # barrel / import boundary (included in doc-gate)
```

## Governance

See [`MIGRATION-MAP.md` §19](MIGRATION-MAP.md#۱۹-documentation-governance--dod).
