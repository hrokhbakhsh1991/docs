import { WORKSPACE_WIZARD_CLONE_REMINT_BINDINGS } from "./workspace-wizard-clone-remint-bindings.generated";

export type WorkspaceWizardCloneRemintBinding =
  (typeof WORKSPACE_WIZARD_CLONE_REMINT_BINDINGS)[number];

function buildBindingMap(): Readonly<Record<string, WorkspaceWizardCloneRemintBinding>> {
  const map: Record<string, WorkspaceWizardCloneRemintBinding> = {};
  for (const binding of WORKSPACE_WIZARD_CLONE_REMINT_BINDINGS) {
    map[binding.workspaceType as string] = binding;
  }
  return Object.freeze(map);
}

const bindingsByWorkspaceType = buildBindingMap();

export function resolveWizardCloneRemintBinding(
  workspaceType: string
): WorkspaceWizardCloneRemintBinding | undefined {
  return bindingsByWorkspaceType[workspaceType];
}

export function workspaceSupportsWizardCloneRemint(workspaceType: string): boolean {
  return resolveWizardCloneRemintBinding(workspaceType) !== undefined;
}
