# Registrations — repositories (persistence slice)

**Repositories = persistence only** (TypeORM `findOne` / query shapes; no actor policy).

**Services = orchestration + policy** (`registrationWhereForActor`, state transitions, validation, DTO mapping).

Extracted gradually; business rules remain in `registrations-policy`, integrity policies, and `RegistrationsService`.
