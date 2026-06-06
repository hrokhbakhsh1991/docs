# Coverage matrix

> **SOURCE OF TRUTH:** subphase ↔ REQ ↔ DAG node

| Subphase | DAG  | Actions      | REQ rows            | Proven by (behavioral)                       | RULE focus       | DoD file                     |
| -------- | ---- | ------------ | ------------------- | -------------------------------------------- | ---------------- | ---------------------------- |
| 5.0      | P5-0 | P5-0-A01–A07 | 001–006             | phase-4:gate + entry yaml                    | RULE-034         | enforcement subphase_dod 5.0 |
| 5.1      | P5-1 | P5-1-A01–A08 | 007,008,033         | phase-5.contract.spec (scaffold)             | RULE-001–004,019 | 5.1                          |
| 5.2      | P5-2 | P5-2-A01–A05 | 009–011,034         | canonical-validate-before-persist.spec       | RULE-003,005     | 5.2                          |
| 5.3      | P5-3 | P5-3-A01–A06 | 012–014,032         | canonical-projection-sync.spec (pending)     | RULE-008–010     | 5.3                          |
| 5.4      | P5-4 | P5-4-A01–A13 | 015–022,035         | **outbox-transactional.spec** (not contract) | RULE-011–018     | 5.4                          |
| 5.5      | P5-5 | P5-5-A01–A03 | 023                 | audit-events-tenant.spec (pending)           | RULE-036         | 5.5                          |
| 5.6      | P5-6 | P5-6-A01–A07 | 024–028,036–040,039 | phase-5:gate + forensic                      | RULE-031–033     | 5.6                          |
| cross    | —    | P5-X-A01–A12 | 029–031,037–038     | —                                            | RULE-006,023,038 | phase_dod                    |

**Parallel after 5.1:** 5.2, 5.3, 5.5 — pick `min(id)` among open per BOOT-MANIFEST  
**5.4 start:** requires 5.1 **and** 5.2 VERIFIED_BEHAVIORAL (not parallel with 5.2)  
**Merge to 5.6:** 5.2–5.5 all VERIFIED_BEHAVIORAL
