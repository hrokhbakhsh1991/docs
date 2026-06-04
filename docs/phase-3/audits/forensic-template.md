# Phase 3 — Forensic truth (Phase 2 lessons)

## FORENSIC TRUTH — §3 PHASE 2 LESSONS

```yaml
forensic_truth_rules:
  - id: FT-P3-P2-DEBT-94
    claim: "Phase 2 Debt Score 94/100 — residual consumer + root build gaps"
    dimensions:
      SB-02_dist: { score: "30/30", phase_3_action: "repeat files + prune-dist for every new publishable" }
      CSS_literals: { score: "25/25", phase_3_action: "P3-UI-00 + P3-E-CSS-01 on every primitive" }
      Barrel_imports: { score: "22/25", gap: "-3 until apps/* tested", phase_3_action: "P3-APP-01 zero barrel in apps/**" }
      CI_enforcement: { score: "17/20", gap: "-3 root build without artifact guard", phase_3_action: "P3-CI-01 phase-3:gate includes guard:artifact-surface" }
    audit_ref: docs/audits/phase-2-zero-debt-forensic-audit-2026-06-02.mdoc
  - id: FT-P3-SB-01
    claim: "theme-react ./internal was public bypass — not private-on-disk"
    phase_3_rule: "every theme-react wrapper via provider + ingress — FORBIDDEN new mapper export"
    enforcement: P3-E-L01
    invariant: P3-THM-01
  - id: FT-P3-SB-02
    claim: "dist/** deep-import — private ≠ absent from index only"
    phase_3_rule: "guard:artifact-surface + files whitelist every publishable build"
    enforcement: P3-E-ARTIFACT
    invariant: P3-PKG-01
  - id: FT-P3-BARREL
    claim: "Barrel index pulls full resolve surface — bundler + human error"
    phase_3_rule: "subpath + absent exports['.'] for ui-primitives; sideEffects CSS whitelist"
    enforcement: P3-E-BARREL
    invariant: P3-APP-01
  - id: FT-P3-CONSUMER
    claim: "apps/web must show 0 barrel violations in next forensic"
    verify: [test/barrel-hunt.spec.ts, audit-ui-primitives-boundary.mjs, ESLint]
  - id: FT-P3-ROOT-BUILD
    claim: "phase-3:gate must force artifact + import boundary — not rely on bare pnpm build"
    enforcement: P3-CI-01
  - id: FT-P3-MAPPER-ON-DISK
    claim: "theme-react on-disk mappers in files whitelist outside exports — OK if npm resolve blocked"
    enforcement: P3-E-L01 verify:exports
    status: ACCEPTED_L01
  - id: FT-P3-CASL-ORDER
    claim: "Theme without CASL = ingress-only security theater"
    repo_handoff: "ability.can BEFORE validateWorkspaceThemeIngress BEFORE DOM"
    enforcement: P3-E-CASL-01
    invariant: P3-SEC-01
```

---

