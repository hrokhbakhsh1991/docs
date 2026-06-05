# Urban minimal scope

```yaml
scope_version: "2026-06-04-v2"
decision: DEC-P7-002
legacy_semantics_source: legacy/packages/types/src/tour-form-profile-descriptors.ts L283-299
forbidden_legacy_pattern: legacy/apps/web/.../workspace-wizard.config.spec.ts L11-13
```

## Intent

Urban is **starter-plus** — proves genericity, not a second Denali.

## Strip policy (from legacy `urban_event` — plugin-native)

Port these **semantics** into plugin `fieldRegistry` — do **not** import legacy types:

| Legacy rule                                                | Urban plugin rule                               |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `inactiveFieldGroups: itinerary, participation, logistics` | Fields in those groups **absent** from registry |
| `clearsRootTransportModes: true`                           | No `transportModes` in canonical schema         |
| `itineraryKeysToDelete: dayPlans, segmentActivities`       | N/A — itinerary group inactive                  |
| `defaultTourType: "city"`                                  | Default workspace tour type `city`              |

## Field registry (canonical paths)

| Path               | Type     | Required | Validation                 |
| ------------------ | -------- | -------- | -------------------------- |
| `tour.title`       | string   | yes      | minLength 1, maxLength 200 |
| `tour.city`        | string   | yes      | minLength 1                |
| `tour.venueName`   | string   | yes      | minLength 1                |
| `tour.startDate`   | ISO date | yes      | `<= tour.endDate`          |
| `tour.endDate`     | ISO date | yes      | `>= tour.startDate`        |
| `tour.capacity`    | integer  | yes      | min 1, max 50000           |
| `tour.description` | string   | no       | maxLength 5000             |
| `tour.status`      | enum     | yes      | `draft \| published`       |

## Forbidden fields (must fail validateCanonical if present)

- `tripDetails.itinerary.*`
- `tripDetails.participation.*`
- `transportModes`
- Any Denali finance / MinIO photo keys

## Composites (target)

| composite_id             | Purpose                           |
| ------------------------ | --------------------------------- |
| `urban.cityTourSummary`  | city + venue + dates summary card |
| `urban.publishReadiness` | minimal publish checklist         |

## Theme

- `packages/workspaces/urban/theme/tokens.css` — Phase 2 ingress contract

## Verification

- REQ-P7-014 — `urban-tour-invalid-itinerary.json` must **fail**
- REQ-P7-031 — registry matches this table
- SMK-P7-03 in [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)

## Out of scope

Finance, MinIO, migrateCanonical bulk, full legacy web tree — see DEC-P7-002.
