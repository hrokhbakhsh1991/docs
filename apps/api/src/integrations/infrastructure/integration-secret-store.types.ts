export type IntegrationSecretPayload = Record<string, unknown>;

export type IntegrationSecretStore = {
  put(tenantId: string, secretRef: string, payload: IntegrationSecretPayload): Promise<void>;
  get(tenantId: string, secretRef: string): Promise<IntegrationSecretPayload | null>;
  delete(tenantId: string, secretRef: string): Promise<void>;
};

export function buildIntegrationSecretRef(connectionId: string): string {
  return `integration-connection:${connectionId}`;
}

export function maskSecretRef(secretRef: string | null | undefined): string | null {
  if (secretRef === null || secretRef === undefined || secretRef.trim().length === 0) {
    return null;
  }
  const trimmed = secretRef.trim();
  if (trimmed.length <= 12) {
    return "ref_***";
  }
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}
