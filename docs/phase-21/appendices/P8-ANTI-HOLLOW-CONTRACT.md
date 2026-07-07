# P8 — Anti-hollow contract (agents)

```yaml
contract_id: P8-ANTI-HOLLOW-CONTRACT
pack_version: "1.0"
fail_token: P8_FAIL
authority: P8-BOOT-MANIFEST.yaml · P8-IMPLEMENTATION-TRUTH.md
```

> **Rule:** `p8:gate` green ≠ Profile B VPS proven. Agents must cite **proof tier** per nano.

---

## Proof tier enum

| Tier | Meaning | Counts toward P8 exit |
| ---- | ------- | --------------------- |
| **DOC** | Doc/runbook/comment only | No |
| **DEV_STATIC** | `p8:gate` · pack integrity · ripgrep wiring | Partial — not Profile B |
| **PROFILE_A** | `*.localhost` smoke / unit on dev hosts | Yes (Profile A axis) |
| **PROFILE_B** | VPS IP `:3000–3003` or `127.0.0.1` on box | Yes (Profile B axis) |
| **REGRESSION** | `p6:gate` + `p7:gate` after code touch | Required — not exit alone |

---

## Gate / check — proves vs does_not_prove

| Gate / check | proves | does_not_prove |
| ------------ | ------ | -------------- |
| `pnpm run p8:gate` | Doc pack + p7 regression + pack integrity keys | Cookie isolation on real IP browser |
| `p8-pack-integrity.spec.ts` | BOOT-MANIFEST · 14 verify keys · fail_token | Behavioral session on VPS |
| `rg` cookie rename in source | Static wiring | Two browsers IP:3000 vs :3003 no bleed |
| Reading p8-app-fit.md | Scope clarity | Implementation |
| `pnpm run p7:staging-verify` on VPS | M+P/api subset on Profile B | Full P8 exit all gaps closed |
| `smoke-p6-host-bind.mjs` | Host→tenant API chain | Session cookie names |
| Doc-only turn | Spec updated | G-* gap closed |

---

## Forbidden claims (`P8_FAIL`)

```yaml
forbidden_claims:
  - "P8 complete" when profile_b_proof: NOT_STARTED
  - "Profile B session 9/10" on IP without documenting 8/10 cap
  - "G-SES-01 done" from renaming cookie in web only (portal must match strategy)
  - "G-ENV-01 done" from editing README without bootstrap-server.sh 4 files
  - Mark exit checklist without command log in IMPLEMENTATION-TRUTH
  - Implement guest-surface-host or delete web public-auth "while in P8"
  - Add __Host- cookie prefix on HTTP Profile B
  - Add Caddy/TLS "for completeness"
  - Skip Wave A and start Wave B/C
  - Use p8:gate PASS to tick Profile B without PROFILE_B tier command
  - Move tenant_domains.surface enforce to P8 (owner P10 G-ING-04b)
```

---

## Hollow patterns (agents)

| Pattern | Why hollow | Valid instead |
| ------- | ---------- | ------------- |
| Comment-only fail-closed JWT | No runtime check | middleware test or staging login |
| Cookie rename in constants only | Not wired to Set-Cookie | grep build-session-cookie usage |
| bootstrap doc without script change | G-ENV-01 open | bootstrap-server.sh copies 4 templates |
| marketing fail-closed in dev only | G-ING-02 needs NODE_ENV=production path | test prod bootstrap branch |
| Bulk-read all 14 nanos before one fix | Scope creep | BOOT-MANIFEST current nano only |
| "Defer to P9" for G-SES-01 | Wrong owner — session is P8 | Implement cookie rename |

---

## Agent workflow (linear)

```yaml
AGENT_WORKFLOW_LINEAR:
  1: READ P8-BOOT-MANIFEST.yaml boot_sequence_T0
  2: DETECT current_nano (first not PASS in IMPLEMENTATION-TRUTH)
  3: DOC-FIRST if touching apps/api packages/platform-core workspace-sdk
  4: LOAD P8-VERIFICATION-COMMANDS.yaml#nano only
  5: RUN commands — capture exit_code + expect_token
  6: EMIT turn_report per P8-AGENT-TURN-SCHEMA.md
  7: UPDATE IMPLEMENTATION-TRUTH + exit checklist IF proof_tier >= PROFILE_A
  8: pnpm run p8:gate after any code touch

forbidden:
  - "Implement P8-1 before P8-0-N-001 PROFILE_A or DEV_STATIC PASS"
  - "Claim Profile B from localhost-only commands"
  - "Load p8-audit.md as sole boot"
```

---

## References

- [P8-AGENT-TURN-SCHEMA.md](P8-AGENT-TURN-SCHEMA.md)
- [P8-VERIFICATION-COMMANDS.yaml](P8-VERIFICATION-COMMANDS.yaml)
- [P8-EXECUTION-DISCIPLINE.md](P8-EXECUTION-DISCIPLINE.md)
