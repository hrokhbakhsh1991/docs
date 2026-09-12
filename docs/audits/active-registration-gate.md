# Active registration gate audit

## Contract

For a given tenant and tour, an authenticated member may have at most one active self
registration. A registration for another guest remains allowed, but the same guest must not be
submitted again while that guest's registration is active.

The active lifecycle excludes `cancelled` and `rejected`. The backend is the final authority; the
portal gate is the user-facing projection of that decision.

## Portal path

The portal registration page resolves the member's active self registration before resuming the
intake flow and passes its id as `existingSelfRegistrationId`. Denali then locks the self
participant, displays the existing-registration status, and leaves the other-guest path available.

The marketing `register-another` action intentionally targets the portal registration route. That
route must repeat the self lookup; it cannot rely on the marketing page's server-rendered CTA state.

## Enforcement and regression coverage

- `findActiveGuestDuplicate` excludes `registrantTarget=other` for the self lookup.
- The registration write path rejects duplicate self and guest identities server-side.
- Portal resume tests assert that the self-registration id reaches the flow.
- Denali intake tests assert that an existing self registration locks the self participant.
- The provider-independent notification mapping test explicitly uses the memory inbox so the
  Postgres phase gate does not route it into an unrelated database fixture.
