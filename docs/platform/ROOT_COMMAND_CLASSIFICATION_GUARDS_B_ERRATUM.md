# Guard Cohort 3B Erratum

**Status:** Active correction  
**Applies to:** [`ROOT_COMMAND_CLASSIFICATION_GUARDS_B.md`](./ROOT_COMMAND_CLASSIFICATION_GUARDS_B.md)  
**Captured:** 2026-07-29

The command tables in cohort 3B contain **19** commands:

- 5 Guest Platform leaves;
- 7 Member Platform entries (6 leaves and 1 composite);
- 2 Portal Surface leaves;
- 5 Routing/Authority entries (4 leaves and 1 composite).

The correct cohort totals are:

| Metric                     | Correct value |
| -------------------------- | ------------: |
| Reviewed in cohort 3B      |            19 |
| Previously reviewed        |           119 |
| Total reviewed             |           138 |
| Remaining                  |           167 |
| Composite guards in cohort |             2 |
| Leaf guards in cohort      |            17 |

The `21 / 140 / 165` summary values in the parent cohort document are a manual
arithmetic error. The command names, classes, owners, and protection reasons in
its tables remain valid.

Machine validation found:

```text
guardCohort: 19
unique: 19
missing: 0
duplicates: 0
overlap: 0
totalReviewed: 138
remaining: 167
```

This erratum is the numeric authority until the parent summary can be corrected
directly.
