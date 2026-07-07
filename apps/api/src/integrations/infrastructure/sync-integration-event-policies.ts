import type { Prisma } from "@prisma/client";

export type IntegrationEventPolicyPatch = {
  readonly eventType: string;
  readonly enabled: boolean;
};

export function parseIntegrationEventPolicyPatches(
  raw: unknown,
  allowedEventTypes: ReadonlySet<string>
): readonly IntegrationEventPolicyPatch[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const patches: IntegrationEventPolicyPatch[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const policy = entry as Record<string, unknown>;
    const eventType = typeof policy.eventType === "string" ? policy.eventType.trim() : "";
    if (eventType.length === 0 || !allowedEventTypes.has(eventType) || seen.has(eventType)) {
      continue;
    }
    seen.add(eventType);
    patches.push({ eventType, enabled: policy.enabled === true });
  }
  return patches;
}

export async function syncIntegrationEventPoliciesInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly policies: readonly IntegrationEventPolicyPatch[];
  }
): Promise<void> {
  for (const policy of input.policies) {
    await tx.integrationEventPolicy.upsert({
      where: {
        integrationConnectionId_eventType: {
          integrationConnectionId: input.connectionId,
          eventType: policy.eventType,
        },
      },
      create: {
        tenantId: input.tenantId,
        integrationConnectionId: input.connectionId,
        eventType: policy.eventType,
        enabled: policy.enabled,
      },
      update: { enabled: policy.enabled },
    });
  }
}
