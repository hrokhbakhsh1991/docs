# P7 pack — extension guide (modular growth)

```yaml
guide_id: PACK-EXTENSION-GUIDE
pack: P7
version: "1.6"
authority: P7-DOC-ARCHITECTURE.md · DOC-SYNC-INDEX.md · P7-BOOT-MANIFEST.yaml
```

How to extend Phase 20 **without breaking** the 27-nano baseline or P6 regression.

---

## 1. What you can extend

| Extension type | Allowed | Procedure |
| -------------- | ------- | --------- |
| New **nano** inside existing EPIC | Yes (minor version bump) | Add row to EPIC + TRACEABILITY + checklist |
| New **EPIC** P7-4+ | Yes (major bump) | New `p7-4-*.md` + DOC-SYNC epics block |
| New **runbook** | Yes | Link from nano · FILE-MAP |
| New **appendix** (boundary/decision) | Yes | DEC-P7 index or boundary doc |
| Change P6 frozen semantics | **No** | New phase pack (POST-P7) |

---

## 2. Nano extension checklist

When adding `P7-x-N-0NN`:

```text
1. EPIC spec §Nanos — proof_tier · verify_ref · repo_status
2. appendices/P7-VERIFICATION-COMMANDS.yaml — full nano block
3. appendices/P7-TEST-INVENTORY.md — if new spec
4. appendices/TRACEABILITY-MATRIX-P7.md — verify_ref row
5. p7-exit-checklist.md — doc/staging/manual columns
6. P7-BOOT-MANIFEST.yaml execution_order += nano
7. DOC-SYNC-INDEX.md — nano_total += 1
8. AGENT-CURRENT-PHASE.yaml — nano_total
9. Optional: SMOKE-SCENARIO-MAP if new SMK-P7-* id
10. p7-pack-integrity.spec.ts — VC key count if nano_total changes
11. IMPLEMENTATION-TRUTH-P7 — honesty matrix row
```

**Version bump:**

| Change | pack_version |
| ------ | ------------ |
| New nanos in existing EPIC | 1.0 → 1.1 (minor) |
| New EPIC | 2.0 (major) |
| Doc-only clarity | patch note in IMPLEMENTATION-TRUTH |

---

## 3. EPIC extension (P7-4 example)

```text
docs/phase-20/p7/
  p7-4-custom-domain.md          # new EPIC spec
  appendices/TRACEABILITY-MATRIX-P7.md  # append section
  DOC-SYNC-INDEX.md              # execution_order + epics.P7-4
  AGENT-NAVIGATOR.md             # new decision branch
  platform-denali-customer-delivery.mdoc  # EPIC map table
```

Prerequisite: [POST-P7-HORIZON.md](POST-P7-HORIZON.md) trigger met (e.g. customer sign-off for Z4).

---

## 4. Code extension zones (recap)

| Zone | Extend by |
| ---- | --------- |
| Z1 Freeze | **Do not** — document in POST-P7 |
| Z2 Complete | Fix same field/step in existing wizard/settings |
| Z3 Additive | New route under `/tours/[id]/workspace/*` or manifest HTTP group |
| Z4 Later | New phase pack or P7-4 EPIC after sign-off |

---

## 5. Anti-patterns

```text
❌ Duplicate nano table in umbrella mdoc (use TRACEABILITY)
❌ Staging proof marked doc-only complete
❌ Gateway/PSP work labeled P7-x-N-* (belongs P5-D / POST-P7)
❌ TEMP/ or out-of-repo specs (docs-as-code only)
❌ Skip p7:gate because "docs only" when code touched
```

---

## References

- [DEC-P7-INDEX.md](DEC-P7-INDEX.md)
- [P6-P7-BOUNDARY.md](P6-P7-BOUNDARY.md)
