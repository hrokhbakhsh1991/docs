# ADR-GP-002 — Guest Extension Schema Admission

## Status

Accepted.

## Context

Guest-facing manifest blocks drive SDK maps, plugin-host bootstrap, portal behavior, marketing presentation, and dev tenant resolution. Silent partial blocks would create wrong UI or runtime fallbacks.

## Decision

Guest-capable manifests must declare `guestExtensionsVersion: 1`.

The documented schema is `docs/dev/workspace-guest-extensions.schema.json`. The generator performs local admission checks before output generation:

- guest extension blocks require `guestExtensionsVersion: 1`;
- `guestThemeStylesheets.portal` and `.marketing` must be string arrays;
- existing manifest validators remain authoritative for catalog routes, presentation, flow, reuse, and member profile field validation.

## Consequences

New guest extension versions require an explicit schema/version bump. Workspaces without guest surfaces can remain L0 without declaring guest extension version.

