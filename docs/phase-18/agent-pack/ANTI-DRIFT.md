# P5 — AI anti-drift catalog (mandatory read)

Score target: prevent agent shortcuts that regress Denali operator product.

## Severity S0 — STOP immediately

| ID | Drift pattern | Correct action |
|----|---------------|----------------|
| AD-S0-01 | Edit `denali/src/rules/` for "metadata parity" | Keep package rules; merge via adapter + DB snapshot |
| AD-S0-02 | Delete composites or move to Super Admin | Composites stay in Denali package `src/ui/` |
| AD-S0-03 | Big-bang prod metadata flag | Staging allowlist pilot only (P5-A) |
| AD-S0-04 | Add Prisma `cutover_stage` column | Use `deriveMetadataCutoverStage` computed field |
| AD-S0-05 | Invent audit action strings | Use `TENANT_DEFINITION_ASSIGNED` / `CLEARED` |
| AD-S0-06 | Gateway payment for Denali tenant | Fixed `offline_receipt` — receipts flow only |
| AD-S0-07 | Skip `guard:p3-denali-covenant` | Run before every commit touching denali overlay |
| AD-S0-08 | Hollow test `assert.ok(true)` | Use assert IDs from epic spec tables |

## Severity S1 — reject PR

| ID | Drift pattern | Correct action |
|----|---------------|----------------|
| AD-S1-01 | Implement P5-C before P5-core exit | Finish P5-A + P5-B path A first unless Architect enables |
| AD-S1-02 | PSP outbound before egress (P5-D-N-002) | Egress allowlist first |
| AD-S1-03 | Change phase-18 mdoc without TEMP epic sync | Update both + FILE-MAP |
| AD-S1-04 | Touch non-manifest files without nano | One nano = manifest file list only |
| AD-S1-05 | Copy legacy/ imports into apps/api | Port patterns, not paths (import boundary) |

## Severity S2 — warn / fix before merge

| ID | Drift pattern | Correct action |
|----|---------------|----------------|
| AD-S2-01 | Mixed Persian/English in code comments | English in code; Persian OK in TEMP human summaries |
| AD-S2-02 | Skip FILE-MAP update | R16 in AGENT-START |
| AD-S2-03 | Run phase-5:gate without YES | Fast track: `p5:gate` only |

## Verification hook

`apps/api/test/p5-anti-drift-contract.spec.ts` — static scan for forbidden patterns in changed files (P5-A-N-012b optional).

## Cross-refs

- `PRESERVATION-CHECKLIST.md` PC-01..10
- `p5-denali-safety.md` R0..R8
- `AGENT-CONTEXT.md` §STOP
