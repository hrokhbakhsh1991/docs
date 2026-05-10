# Read scaling and replicas

Routing for **read replicas** or CQRS-style read models is **not implemented in application code** in this repository. Operations teams configure PostgreSQL replication (streaming logical/physical replicas) and connection strings (separate DSN for readers vs writer) at the infrastructure layer.

When the product needs read/query offload from the primary (heavy list reports, analytics), add environment-driven DataSource selection or a dedicated read pool in code—until then, scaling reads remains an **ops and DSN** concern.

Hot catalog paths already use Postgres FTS (`search_vector`) and keyset pagination on `tours` to reduce primary load without a separate search tier.
