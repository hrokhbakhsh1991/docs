import { getIntegrationSecretStore } from "../infrastructure/integration-secret-store";
import type { IntegrationConnectionRecord } from "../platform/integration-connection.types";
import { resolveLegacyTelegramConnectionRecord } from "../infrastructure/resolve-legacy-telegram-connection";

/** Resolves delivery credentials — secret store first, legacy credentials column fallback. */
export async function resolveIntegrationConnectionCredentials(
  connection: IntegrationConnectionRecord
): Promise<Record<string, unknown>> {
  if (connection.secretRef !== null && connection.secretRef.trim().length > 0) {
    const fromStore = await getIntegrationSecretStore().get(
      connection.tenantId,
      connection.secretRef
    );
    if (fromStore !== null) {
      return fromStore;
    }
  }
  if (Object.keys(connection.credentials).length > 0) {
    return connection.credentials;
  }
  return {};
}

export async function resolveDeliveryConnection(input: {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly workspaceType: string | null;
}): Promise<
  (IntegrationConnectionRecord & { readonly credentials: Record<string, unknown> }) | null
> {
  if (input.connectionId.startsWith("legacy-telegram:")) {
    const legacy = await resolveLegacyTelegramConnectionRecord(input.tenantId, input.workspaceType);
    if (legacy === null) {
      return null;
    }
    return legacy;
  }

  const { createIntegrationConnectionRepository } =
    await import("../infrastructure/prisma-integration-connection.repository");
  const repository = createIntegrationConnectionRepository();
  const connection = await repository.findById(input.tenantId, input.connectionId);
  if (connection === null || !connection.enabled || connection.status !== "enabled") {
    return null;
  }
  const credentials = await resolveIntegrationConnectionCredentials(connection);
  return { ...connection, credentials };
}
