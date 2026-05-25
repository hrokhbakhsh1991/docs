# Denali Development Protocol

Before implementing any new feature or changing existing logic, every developer (and AI collaborator) must pass the following 5-step "Acid Test":

## The 5-Step Protocol

1.  **Contract-First (Data Safety):**
    * Is there a new field or model? **Define it in `@repo/shared-contracts` first.** Never introduce raw DTOs or unchecked JSONB fields in services.
2.  **Strategy-Based (Workspace Logic):**
    * Is this logic workspace-specific? **Do NOT write `if (profile === ...)` or `switch (tenant)`.** Add a method to `IWorkspaceStrategy` and register it in `WorkspaceStrategyRegistry`.
3.  **Access-Controlled (RBAC):**
    * Who can do this? **Use `workspace-access.helper.ts`.** Never perform ad-hoc role checking or string-based role comparisons in services.
4.  **Atomic (Transaction Integrity):**
    * Does this change involve multiple modules or payment states? **Use an `Orchestrator` to wrap the operation in a single database transaction.**
5.  **UI/Settings (Centralized Config):**
    * Does this impact the settings UI? **Use the centralized helpers** (e.g., `getTourFormProfileOptions`). Do not hardcode lists of options in React components.

## "The Acid Test"

If your feature requires adding new conditional logic (`if`/`switch`) to a service, **STOP.** You are likely violating the architecture. Re-read the `WorkspaceStrategy` pattern and integrate your logic there instead.
