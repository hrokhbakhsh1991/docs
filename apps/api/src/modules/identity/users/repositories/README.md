# Users — repositories (persistence slice)

**Repositories = persistence only** (TypeORM queries, no HTTP/JWT policy).

**Services = orchestration + policy** (tenant resolution, guards, DTO mapping, `toUserResponseDto`, validation).

Extracted gradually; business rules and validators remain in services and shared policy modules.
