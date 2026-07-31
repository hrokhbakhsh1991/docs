# Root Command Classification — Domain Guards A

**Status:** Active — Phase 0 classification ledger, cohort 3A  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](../../../platform/ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 16  
**Previously reviewed:** 103  
**Total reviewed:** 119  
**Remaining:** 186

This cohort is intentionally narrow. Finance, booking, and marketing guards
have clear domain ownership and direct CI or product-gate evidence. No command
in this cohort is a removal candidate.

## Finance and booking

| Command                               | Primary class | Owner            | Protection reason                                      |
| ------------------------------------- | ------------- | ---------------- | ------------------------------------------------------ |
| `guard:finance-core-boundary`         | `LEAF`        | Finance Platform | Direct finance CI and product verification             |
| `guard:finance-golden`                | `COMPOSITE`   | Finance Platform | G1–G7 architecture suite; invoked by finance CI        |
| `guard:booking-boundary`              | `LEAF`        | Booking Platform | Product verification and application-boundary contract |
| `guard:bookings-getbyid-tenant-scope` | `LEAF`        | Booking Platform | Tenant-isolation invariant                             |

`guard:finance-golden` is classified `COMPOSITE`, not `LEAF`, because it
orchestrates multiple architecture proofs, dependency checks, and host-side
invariants. Its duplicate execution across finance workflows is a future CI
consolidation concern, not a reason to remove the command.

## Marketing surface

| Command                              | Primary class | Owner              | Protection reason                                 |
| ------------------------------------ | ------------- | ------------------ | ------------------------------------------------- |
| `guard:marketing-denali-boundary`    | `LEAF`        | Marketing Surface  | Product-boundary enforcement                      |
| `guard:marketing-guest-theme-loader` | `LEAF`        | Marketing Surface  | Guest-theme loading contract                      |
| `guard:marketing-home-hooks`         | `LEAF`        | Marketing Surface  | Direct marketing CI consumer                      |
| `guard:marketing-hreflang`           | `LEAF`        | Marketing Surface  | Direct SEO CI consumer                            |
| `guard:marketing-meta-quality`       | `LEAF`        | Marketing Surface  | Direct metadata CI consumer                       |
| `guard:marketing-prod-image-hosts`   | `LEAF`        | Marketing Surface  | Production image-host policy                      |
| `guard:marketing-semantic-seo`       | `LEAF`        | Marketing Surface  | Direct semantic SEO CI consumer                   |
| `guard:marketing-seo-prod`           | `LEAF`        | Marketing Surface  | Direct production SEO CI consumer                 |
| `guard:marketing-sitemap-host`       | `LEAF`        | Marketing Surface  | Direct sitemap CI consumer                        |
| `guard:marketing-skin-size`          | `LEAF`        | Marketing Surface  | Marketing skin budget                             |
| `guard:jsonld-xss`                   | `LEAF`        | Marketing Security | Direct structured-data security CI consumer       |
| `guard:public-catalog-m17`           | `LEAF`        | Public Catalog     | Marketing/portal catalog contract and CI consumer |

## Family-runner relationship

The `guard:marketing` family invokes marketing guard files directly. That
family provides discovery and full-family execution, while several leaf root
commands remain required for path-filtered CI and targeted diagnosis.

The family and leaf entry points are therefore not behavior-identical aliases.
Any future leaf reduction requires:

1. a CI coverage-parity matrix;
2. preservation of targeted failure reporting;
3. confirmation that product gates do not call the leaf;
4. documentation migration;
5. a compatibility window.

## Cohort decision

- All 16 names exist in the current root `package.json`.
- No name overlaps cohorts 1 or 2.
- One composite and 15 leaf guards are classified.
- Direct CI consumers are protected.
- No command body, workflow, assertion, or product implementation changed.
- The next guard subcohort should cover guest/member/portal authority before
  generic architecture guards.
