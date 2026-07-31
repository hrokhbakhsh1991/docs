# Root Command Classification — Phase and Delivery Gates

**Status:** Active — Phase 0 classification ledger, final cohort  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 59  
**Previously reviewed:** 246  
**Total reviewed:** 305  
**Remaining:** 0

This cohort closes the executable root-command inventory. It separates targeted
proof leaves, composite gates, and externally mutating release operations. No
row is a removal approval.

## Product-era gates

| Command                    | Primary class | Owner                 | Contract                        |
| -------------------------- | ------------- | --------------------- | ------------------------------- |
| `p1:e2e-gate`              | `LEAF`        | Platform Web Quality  | Targeted platform E2E proof     |
| `p1:gate`                  | `COMPOSITE`   | Platform Delivery     | Platform product gate           |
| `p1:gate:full`             | `COMPOSITE`   | Platform Delivery     | Expanded platform product gate  |
| `p1:live-smoke`            | `LEAF`        | Platform Operations   | Live platform smoke             |
| `p4:e2e-gate`              | `LEAF`        | Club Product Quality  | Club-product E2E proof          |
| `p4:gate`                  | `COMPOSITE`   | Club Product Delivery | Club-product gate               |
| `p5:gate`                  | `COMPOSITE`   | Enterprise Evolution  | Enterprise-evolution gate       |
| `p6:closure`               | `COMPOSITE`   | Denali Delivery       | Denali closure bundle           |
| `p6:e2e-gate`              | `LEAF`        | Denali Quality        | Denali E2E proof                |
| `p6:gate`                  | `COMPOSITE`   | Denali Delivery       | Denali product gate             |
| `p7:gate`                  | `COMPOSITE`   | Denali Delivery       | Denali delivery gate            |
| `p8:gate`                  | `COMPOSITE`   | Platform Surface      | Platform-surface gate           |
| `p9:gate`                  | `COMPOSITE`   | Code Consolidation    | Code-consolidation gate         |
| `p10:gate`                 | `COMPOSITE`   | Production Readiness  | Production gate                 |
| `p10:p8-env-regression`    | `LEAF`        | Production Readiness  | P8 environment-regression proof |
| `p10:profile-b-regression` | `LEAF`        | Production Readiness  | Profile-B regression proof      |
| `p10:profile-c-edge-smoke` | `LEAF`        | Production Readiness  | Profile-C edge smoke            |

The `pN:*` namespace records product/delivery evolution and does not mean that
the commands are aliases for same-numbered `phase-N:*` commands.

## Foundation and numbered phase gates

| Command                          | Primary class | Owner                  | Contract                               |
| -------------------------------- | ------------- | ---------------------- | -------------------------------------- |
| `phase-0:foundation-adversarial` | `LEAF`        | Platform Foundation    | Foundation adversarial tests           |
| `phase-0:gate`                   | `COMPOSITE`   | Platform Foundation    | Covenant and trunk proof bundle        |
| `phase-0:guard`                  | `LEAF`        | Platform Foundation    | Foundation report/invariant guard      |
| `phase-0:integration-gate`       | `COMPOSITE`   | Platform Foundation CI | Trunk integration proof bundle         |
| `phase-1:gate`                   | `COMPOSITE`   | Platform Core          | Platform-core closure gate             |
| `phase-1:guard`                  | `LEAF`        | Platform Core          | Platform-core phase invariant          |
| `phase-2:gate`                   | `COMPOSITE`   | Design System          | Design-system closure gate             |
| `phase-2:guard`                  | `LEAF`        | Design System          | Design-system phase invariant          |
| `phase-3:gate`                   | `COMPOSITE`   | Starter Integration    | Starter-integration closure gate       |
| `phase-3:guard`                  | `LEAF`        | Starter Integration    | Starter-integration phase invariant    |
| `phase-4:gate`                   | `COMPOSITE`   | Platform Integration   | Platform-integration closure gate      |
| `phase-4:guard`                  | `LEAF`        | Platform Integration   | Platform-integration phase invariant   |
| `phase-5:gate`                   | `COMPOSITE`   | Performance Platform   | Data/performance closure gate          |
| `phase-5:guard`                  | `LEAF`        | Performance Platform   | Data/performance phase invariant       |
| `phase-6:defensive-guards`       | `COMPOSITE`   | Denali Platform        | Defensive guard bundle                 |
| `phase-6:fast-closure`           | `COMPOSITE`   | Denali Platform        | Reduced closure bundle                 |
| `phase-6:fast-track`             | `COMPOSITE`   | Denali Platform        | Developer fast-track bundle            |
| `phase-6:gate`                   | `COMPOSITE`   | Denali Platform        | Full Denali platform gate              |
| `phase-6:guard`                  | `LEAF`        | Denali Platform        | Denali phase invariant                 |
| `phase-7:adversarial-gate`       | `LEAF`        | Platform Security      | Adversarial proof runner               |
| `phase-7:gate`                   | `COMPOSITE`   | Platform Security      | Full Phase 7 closure gate              |
| `phase-7:guard`                  | `LEAF`        | Platform Security      | Phase 7 document/invariant guard       |
| `phase-7:platform-gate`          | `COMPOSITE`   | Platform Security      | Platform DoD proof runner              |
| `phase-8:gate`                   | `COMPOSITE`   | Platform Evolution     | Full Phase 8 closure gate              |
| `phase-8:guard`                  | `LEAF`        | Platform Evolution     | Phase 8 document/invariant guard       |
| `phase-9:gate`                   | `COMPOSITE`   | Experience Platform    | Full Phase 9 closure gate              |
| `phase-9:guard`                  | `LEAF`        | Experience Platform    | Phase 9 charter guard                  |
| `phase-10:guard`                 | `LEAF`        | Host Platform          | Host-invariant and certification guard |
| `phase-14:wizard-gate`           | `COMPOSITE`   | Wizard Platform        | Wizard closure bundle                  |
| `phase-15:90plus-gate`           | `COMPOSITE`   | Platform Quality       | 90-plus quality bundle                 |
| `phase-15:platform-fast-gate`    | `COMPOSITE`   | Platform Quality       | Platform fast proof bundle             |
| `phase-15:wizard-fast-gate`      | `COMPOSITE`   | Wizard Platform        | Wizard fast proof bundle               |

`phase-0:integration-gate` was previously mentioned only as the target of
`phase-0:trunk-gate`. This row supplies its missing primary classification; a
text reference to a command is not itself an inventory assignment.

## Cross-phase closure and delivery

| Command                   | Primary class | Owner                 | Contract                                 |
| ------------------------- | ------------- | --------------------- | ---------------------------------------- |
| `phase-eph:fast-track`    | `COMPOSITE`   | API Identity Platform | Isolation and identity-ratchet bundle    |
| `phase-g-h:fast-track`    | `COMPOSITE`   | Workspace Delivery    | Phase G/H reduced proof bundle           |
| `phase-g-h:handoff`       | `COMPOSITE`   | Workspace Delivery    | Merge handoff proof and checklist        |
| `phase-g-h:create-pr`     | `OPS_ONLY`    | Workspace Release     | Create DEV-to-main PR through GitHub CLI |
| `phase-g-h:create-pr-api` | `OPS_ONLY`    | Workspace Release     | Create DEV-to-main PR through GitHub API |
| `phase-i:closure`         | `COMPOSITE`   | Workspace Delivery    | Phase I closure bundle                   |
| `phase-i:fast-track`      | `COMPOSITE`   | Workspace Delivery    | Phase I reduced proof bundle             |
| `phase-i:create-pr`       | `OPS_ONLY`    | Workspace Release     | Create Phase I pull request              |
| `phase-psc:fast-track`    | `COMPOSITE`   | Platform Surface      | Surface-cohesion strict closure bundle   |
| `wave-i0:guard`           | `COMPOSITE`   | Platform Evolution    | Wave I0 guard bundle                     |

The three `create-pr` commands can mutate external GitHub state and therefore
remain operational entry points. They must never be folded into a local or CI
verification command without an explicit authorization boundary.

## Consolidation posture

1. `*:guard` leaves remain directly runnable for diagnostics even when a full
   gate consumes them.
2. Full, fast, closure, platform, and adversarial variants are behaviorally
   distinct until their command graphs and environment contracts prove parity.
3. The deep numbered-gate chains are candidates for a shared declarative
   runner, but public command names and CI check contracts should survive the
   first migration window.
4. Historical-looking names require owner approval and active-doc/CI/runbook
   review before archival.
5. External PR creation remains outside all verification-only orchestration.

## Final cohort decision

- All 59 names exist in the current root `package.json`.
- No name overlaps the first 246 classified executable commands.
- All 305 executable root commands now have one primary class and owner.
- The six `//...` deprecation-comment keys are metadata, not executable
  commands, and remain outside the inventory.
- No command body, workflow, branch-protection contract, assertion, or product
  implementation changed.
- Classification completion authorizes consolidation design, not deletion.
