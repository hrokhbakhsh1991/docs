# ERIP — Creativity & Optimization Proposal archive

```yaml
authority: phase-8-agent-router.md §5
guard_check: p8_erip_cop_present
mandatory_subphases: ["8.1", "8.2", "8.3"]
exempt_subphases: ["8.0"]
```

## Filename convention

```text
docs/phase-8/appendices/erip/8.x-cop-YYYY-MM-DD.md
```

## Required YAML front-matter

```yaml
---
subphase: "8.1"
approval_date: "2026-06-07"
vetted_2026_enterprise_source_urls:
  - https://example.com/docs
---
```

Parsed by `scripts/guards/lib/phase-8-guard-lib.mjs` → `evaluateP8EripCopPresent()`.

At active subphase **8.0**, ERIP is exempt. From **8.1** onward, add a COP file before implementation merges.
