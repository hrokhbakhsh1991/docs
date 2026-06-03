# Platform audits archive

Formal audit artifacts that gate phase transitions. Do not delete when advancing phases — they are the compliance record.

| Audit | Phase | Verdict | Document |
|-------|-------|---------|----------|
| Doc compliance | 0 | Docs-as-Code §19 retrofit | Markdoc: [`phase-0-foundation-doc-compliance.mdoc`](phase-0-foundation-doc-compliance.mdoc) |
| Doc compliance | 1 | Docs-as-Code §19 retrofit | Markdoc: [`phase-1-platform-core-doc-compliance.mdoc`](phase-1-platform-core-doc-compliance.mdoc) |
| Documentation integrity | 1 | Engine map + 94 tests + depcruise | [`phase-1-documentation-integrity-2026-06-03.mdoc`](phase-1-documentation-integrity-2026-06-03.mdoc) |
| Zero-debt forensic | 2 (2.5 gate) | **94/100** — SB-02/CSS/barrel green | Markdoc: [`phase-2-zero-debt-forensic-audit-2026-06-02.mdoc`](phase-2-zero-debt-forensic-audit-2026-06-02.mdoc) · legacy [`.md`](phase-2-zero-debt-forensic-audit-2026-06-02.md) |
| Documentation integrity | 2 | Theme Ingress + barrel + forensic links | [`phase-2-documentation-integrity-2026-06-03.mdoc`](phase-2-documentation-integrity-2026-06-03.mdoc) |
| **Zero-debt remediation (Waves A–E)** | 0–3 | **Closed — Zero-Debt Verified** — gate thresholds enforced; `phase-3:gate` 16/16 | [`zero-debt-remediation-audit.md`](zero-debt-remediation-audit.md) |
| Zero-debt forensic | 3 (3.0–3.5 gate) | **100/100** — canonical SoT, CASL, apps/api+web, barrel, `phase-3:gate` exit 0 | Markdoc: [`phase-3-zero-debt-forensic-audit.mdoc`](phase-3-zero-debt-forensic-audit.mdoc) · legacy: [`.md`](phase-3-zero-debt-forensic-audit.md) |
| Documentation integrity | 3 | Doc retrofit + P3-INT-02 tenant binding | [`phase-3-documentation-integrity-2026-06-03.mdoc`](phase-3-documentation-integrity-2026-06-03.mdoc) |

**Phase 2 closure:** Phase 2 is **Closed: Zero-Debt Verified** per the forensic audit and `pnpm run phase-2:gate`. See [`MIGRATION-MAP.md`](../MIGRATION-MAP.md) §11.

**Phase 3 closure:** Phase 3 is **Closed: Zero-Debt Verified** per [`phase-3-zero-debt-forensic-audit.md`](phase-3-zero-debt-forensic-audit.md) and `pnpm run phase-3:gate` → [`reports/phase-3-gate-2026-06-03.json`](../../reports/phase-3-gate-2026-06-03.json).
