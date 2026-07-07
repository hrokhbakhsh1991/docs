# ADR-GP-001 — Registration Flow Manifest Union

## Status

Accepted.

## Context

Guest registration has two valid ownership models:

- A workspace owns the entire flow (`bundle`).
- A workspace reuses platform auth steps and owns only intake/done (`compose`).

Hand-maintained plugin-host step maps created hidden coupling and blocked drop-in workspaces.

## Decision

`catalogRegistrationFlow.steps` is a discriminated union:

- `mode: "bundle"` requires `export`.
- `mode: "compose"` requires `reuseAuthStepsFrom` or `reuseFrom`, plus local `components.intake` and `components.done`.

The generator validates the union and emits `workspace-registration-flow-plugins.generated.ts`.

## Consequences

Unknown reuse sources fail codegen. The portal and plugin-host do not branch on workspace ids.

