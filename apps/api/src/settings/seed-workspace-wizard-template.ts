import type { Prisma } from "@prisma/client";
import { getSettingsConfigRepository } from "./create-settings-config-repository";
import { WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS } from "./workspace-dev-bootstrap-bindings.generated";

type WizardTemplateBinding = (typeof WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS)[number];

type WizardTemplatePayload = {
  readonly published?: boolean;
  readonly steps?: readonly unknown[];
};

function isWizardTemplateAlreadySeeded(
  payload: WizardTemplatePayload,
  minPublishedSteps: number
): boolean {
  return (
    payload.published === true &&
    Array.isArray(payload.steps) &&
    payload.steps.length >= minPublishedSteps
  );
}

/** Idempotent — seeds published wizard template for a manifest devBootstrap binding. */
export async function seedWorkspaceWizardTemplate(
  tenantId: string,
  binding: WizardTemplateBinding
): Promise<void> {
  const repo = getSettingsConfigRepository();
  const existing = await repo.get(tenantId, "wizard_template");
  if (existing != null) {
    const payload = existing.payload as WizardTemplatePayload;
    if (isWizardTemplateAlreadySeeded(payload, binding.minPublishedSteps)) {
      return;
    }
  }

  const payload = binding.buildPayload();
  await repo.seed({
    tenantId,
    configKey: "wizard_template",
    configVersion: 1,
    payload,
    updatedAt: new Date().toISOString(),
  });
}

/** Seeds wizard template when `tenantId` appears in any binding's `tenantIds`. */
export async function seedWorkspaceWizardTemplateForTenant(tenantId: string): Promise<void> {
  for (const binding of WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS) {
    if ((binding.tenantIds as readonly string[]).includes(tenantId)) {
      await seedWorkspaceWizardTemplate(tenantId, binding);
    }
  }
}

/**
 * P1-N-051: Seeds wizard template by workspaceType (production-safe).
 * Finds binding by workspaceId and seeds template for any tenant.
 */
export async function seedWorkspaceWizardTemplateForWorkspaceType(
  tenantId: string,
  workspaceType: string
): Promise<void> {
  const binding = WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS.find(
    (b) => b.workspaceId === workspaceType.toLowerCase()
  );

  if (binding) {
    await seedWorkspaceWizardTemplate(tenantId, binding);
  }
}

/**
 * Seeds wizard template inside a provision transaction.
 * Must use `tx` — settings repo uses a separate connection and breaks FK before commit.
 */
export async function seedWorkspaceWizardTemplateInTransaction(
  tx: Prisma.TransactionClient,
  tenantId: string,
  workspaceType: string
): Promise<void> {
  const binding = WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS.find(
    (b) => b.workspaceId === workspaceType.toLowerCase()
  );
  if (binding == null) {
    return;
  }

  const existing = await tx.tenantConfig.findUnique({
    where: {
      tenantId_configKey: { tenantId, configKey: "wizard_template" },
    },
  });
  if (existing != null) {
    const payload = existing.payload as WizardTemplatePayload;
    if (isWizardTemplateAlreadySeeded(payload, binding.minPublishedSteps)) {
      return;
    }
  }

  const payload = binding.buildPayload();
  await tx.tenantConfig.upsert({
    where: {
      tenantId_configKey: { tenantId, configKey: "wizard_template" },
    },
    create: {
      tenantId,
      configKey: "wizard_template",
      configVersion: 1,
      payload: payload as Prisma.InputJsonValue,
    },
    update: {
      configVersion: { increment: 1 },
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

// Made with Bob
