# Guest Plugin Waivers

Guest plugin conformance waivers are exceptional and temporary.

## Required Fields

Each waiver file must include:

- `id`: stable waiver id, for example `guest-plugin-W001`
- `scope`: affected guard or workspace
- `reason`: why the guard cannot pass now
- `owner`: human owner
- `expires`: ISO date
- `exitCriteria`: concrete condition for removal

## Current Waivers

None.

## Policy

G4 closure requires zero active waivers unless the Architect records explicit sign-off in `docs/dev/guest-plugin-conformance.md`.

