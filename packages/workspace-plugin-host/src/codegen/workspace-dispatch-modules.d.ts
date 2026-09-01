/**
 * Ambient module declarations for codegen static-import dispatch targets (CW7/CW9).
 * Runtime resolves workspace packages after full monorepo build; compile-time shims
 * break circular workspace-plugin-host ↔ workspace package ordering.
 */
declare module "@app-tour/workspace-cert-club/host/transport/register-transport-initializer" {
  export function registerCertClubCatalogRegistrationTransportInitializer(): void;
}

declare module "@app-tour/workspace-denali/host/catalog/registration-flow/register-transport-initializer" {
  export function registerDenaliCatalogRegistrationTransportInitializer(): void;
}
