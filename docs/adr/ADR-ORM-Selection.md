# ADR: ORM Selection

## Context
Early architecture drafts referenced Prisma ORM for database access.

## Decision
The project uses TypeORM as the ORM implementation.

## Rationale
In restricted or air-gapped environments Prisma requires engine binaries that must be downloaded from external sources. This created reliability issues for development and CI environments without internet access.

TypeORM does not require external engine binaries and works reliably in restricted environments.

## Consequences
- The overall architecture remains unchanged.
- Multi-tenant isolation strategy remains the same.
- PostgreSQL remains the primary database.
- Repository and entity patterns are implemented using TypeORM.
- Documentation is updated to keep the ORM layer tool-agnostic where possible.
