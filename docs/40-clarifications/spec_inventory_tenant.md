# Tenant Behavior Inventory (v1)

## Current Tenant Model – Descriptive Analysis

- The practical tenant key across active documentation is `tenant_id`. This appears explicitly in intake and contract-oriented documents, and implicitly in technical/flow requirements through terms like "tenant-scoped" and "tenant isolation".
- No active documentation in this repository currently uses `workspace_id`, `org_id`, or `account_id` as primary tenant keys.
- A "workspace" concept appears in narrative form (for example, leader workspace context), but not as a formally modeled identifier field such as `workspace_id`.

### Tenant Key Usage in Practice

- **Primary key in docs:** `tenant_id`
- **Secondary context signals (narrative/spec-level):** auth/session tenant context, route/workspace context, admin target tenant context.
- **Observed pattern:** payload fields may include `tenant_id`, while trusted runtime context is described as auth/session-bound in technical and policy drafts.

### Identifier Scoping as Currently Documented

- `tour_id` is operationally used with tenant boundaries (especially in reconciliation/export and flow scoping language).
- `registration_id` is system-assigned in intake schema, but global uniqueness versus tenant-scoped uniqueness is not explicitly finalized in active baseline docs.
- Registration uniqueness is strongly expressed as `(user_id, tour_id)` for active states, with tenant scope implied by surrounding requirements and technical constraints.
- Export and reconciliation are described as tenant- and tour-scoped in active contract docs.

### Admin / Backoffice Cross-Tenant Behavior (Current State)

- Technical documentation mentions admin-level global access being isolated from tenant-facing surfaces.
- Operational requirement/test baselines strongly enforce tenant-scoped reads/writes for core operational domains.
- In current draft tenant specs under `docs/specs`, MVP posture is documented as single-tenant context for admin operations, while post-MVP cross-tenant behavior remains open/undecided.
- Therefore, cross-tenant admin behavior is present as a documented possibility at architecture level, but not operationally finalized for MVP execution paths.

### Observed Patterns

- Most operational behavior is documented as tenant-scoped for registration, waitlist, payment, dashboard, and export.
- Intake contracts explicitly include `tenant_id`; many other artifacts rely on tenant-scoped language without always restating exact field-level enforcement.
- KPI and security monitoring include explicit cross-tenant incident tracking (`KPI-10`) and boundary-block events, indicating expected detection of tenant-scope violations.
- Test strategy includes a dedicated tenant safety gate, but test references are mostly requirement-level mappings rather than stable per-test IDs.

## Inconsistencies and Risks

- **Multiple tenant context representations (conceptual vs field-level)**
  - Some artifacts describe tenant enforcement via `tenant_id` field constraints.
  - Others describe tenant enforcement via auth/session/workspace context without field-level normalization.
  - Risk category: **Ambiguous scoping model**.

- **Identifier scoping uncertainty**
  - `tour_id` and `registration_id` are used in tenant-scoped operations, but explicit global-vs-tenant uniqueness statements are incomplete across baseline docs.
  - Risk category: **Ambiguous identifier scope**.

- **Admin cross-tenant ambiguity**
  - Architecture-level text references global admin access isolation, while operational tenant drafts set MVP to single-tenant admin context.
  - Risk category: **Unclear cross-tenant capability boundary**.

- **Partial predicate explicitness**
  - Tenant-scoped behavior is broadly mandated, but not every query class is explicitly enumerated in core baseline docs (by-id, list/search, aggregate, export) with uniform predicate language.
  - Risk category: **Potential missing tenant filter in interpretation**.

- **Traceability maturity gap**
  - Requirement-to-test mapping exists, but many tenant checks are not tied to stable, uniquely named test cases in active docs.
  - Risk category: **Verification traceability ambiguity**.

- **Conceptual vs finalized KPI/event links**
  - Some tenant monitoring links are explicit (`KPI-10`, tenant-scope violation events), while others remain noted as conceptual/open in draft traceability materials.
  - Risk category: **Monitoring contract incompleteness**.
