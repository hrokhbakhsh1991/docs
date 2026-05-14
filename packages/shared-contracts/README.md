# `@repo/shared-contracts`

Cross-cutting **Zod** schemas for API + web + workers. This package is the home for **shared validation** and **type inference** (`z.infer`) so frontends and backends agree on primitive shapes before full DTO migration.

## Goals

- **Shared schemas** — one definition for enums, ids, and wire formats used in multiple runtimes.
- **FE / BE consistency** — import the same `*Schema` in Next.js and Nest (or generate TS types from a single source later).
- **Runtime validation** — parse untrusted JSON at boundaries (HTTP, webhooks, queue payloads) with `.safeParse` / `.parse`.

## Layout

| Folder    | Intended contracts                                      |
| --------- | ------------------------------------------------------- |
| `auth/`   | Login/session/MFA-related payloads (placeholders TBD) |
| `booking/` | Booking lifecycle, registrations-facing fields        |
| `finance/` | Money minors, ledger snapshots, payment intents       |
| `users/`  | Directory / membership / role strings                 |

## TODO

- **OpenAPI** — generate or align OpenAPI components from Zod (e.g. `zod-to-openapi` or pipeline TBD).
- **Contract snapshot tests** — golden JSON fixtures per schema version for CI drift detection.

## Non-goals (for now)

- Mass-moving Nest `class-validator` DTOs here — migrate incrementally behind feature flags or new endpoints.
