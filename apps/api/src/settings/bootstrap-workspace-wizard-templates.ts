import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { logger } from "../observability/logger";

import { WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS } from "./workspace-dev-bootstrap-bindings.generated";
import { seedWorkspaceWizardTemplate } from "./seed-workspace-wizard-template";

/** Idempotent dev bootstrap — memory driver and fresh dev DB get published wizard templates. */
export async function bootstrapWorkspaceWizardTemplatesIfNeeded(): Promise<void> {
  if (isProductionAuthMode()) {
    return;
  }

  for (const binding of WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS) {
    for (const tenantId of binding.tenantIds) {
      try {
        await seedWorkspaceWizardTemplate(tenantId, binding);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          {
            event: "settings.wizard_template.bootstrap_failed",
            tenantId,
            workspaceId: binding.workspaceId,
            error: message,
          },
          "workspace wizard template bootstrap skipped for tenant"
        );
      }
    }
  }
}
