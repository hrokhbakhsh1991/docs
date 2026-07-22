import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { ensureWizardHostAdapters } from "@/wizard/host-adapter-runtime";
import { ensureAllTourActionSubmitCodecs } from "@/bootstrap/workspace-tour-action-submit-bindings.generated";
import { ensureOperatorUiComponentsSurface } from "@/bootstrap/workspace-operator-ui-components-bindings.generated";
import { ensureWizardCreateChromeSurface } from "@/bootstrap/workspace-wizard-create-chrome-bindings.generated";
import { ensureWizardCreateViewSurface } from "@/bootstrap/workspace-wizard-create-view-bindings.generated";
import { ensureWizardDraftShellSurface } from "@/bootstrap/workspace-wizard-draft-shell-bindings.generated";
import { ensureWizardDraftUnificationSurface } from "@/bootstrap/workspace-wizard-draft-unification-bindings.generated";
import { ensureWizardFlatEditChromeSurface } from "@/bootstrap/workspace-wizard-flat-edit-chrome-bindings.generated";
import { ensureWizardFlatEditFormSurface } from "@/bootstrap/workspace-wizard-flat-edit-form-bindings.generated";
import { ensureWizardFlatEditPageSurface } from "@/bootstrap/workspace-wizard-flat-edit-page-bindings.generated";
import { ensureWizardTemplateFieldOverlaysAugment } from "@/bootstrap/workspace-wizard-template-gate-bindings.generated";
import { ensureGeneratedLabelResolver } from "@/wizard/resolve-wizard-submit-error-message";
import { loadWizardWorkspacePlugin } from "@/wizard/resolve-wizard-workspace-plugin";

/**
 * Gap Closure B.5–B.10 — parallel plugin load + dynamic binder warm for operator create/flat-edit.
 */
export async function warmOperatorWizardShell(pluginId: string): Promise<WorkspacePlugin> {
  const [plugin] = await Promise.all([
    loadWizardWorkspacePlugin(pluginId),
    ensureGeneratedLabelResolver(pluginId),
    ensureAllTourActionSubmitCodecs(),
    ensureWizardDraftUnificationSurface(pluginId),
    ensureWizardTemplateFieldOverlaysAugment(pluginId),
    ensureWizardCreateViewSurface(pluginId),
    ensureWizardFlatEditPageSurface(pluginId),
    ensureWizardCreateChromeSurface(pluginId),
    ensureWizardFlatEditChromeSurface(pluginId),
    ensureWizardFlatEditFormSurface(pluginId),
    ensureWizardDraftShellSurface(pluginId),
    ensureOperatorUiComponentsSurface(pluginId),
    ensureWizardHostAdapters(),
  ]);
  return plugin;
}
