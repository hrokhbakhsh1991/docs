import { WORKSPACE_WIZARD_MEDIA_BINDINGS } from "./workspace-wizard-media-bindings.generated";

export type WorkspaceWizardMediaBinding =
  (typeof WORKSPACE_WIZARD_MEDIA_BINDINGS)[number];

function buildBindingMap(): Readonly<Record<string, WorkspaceWizardMediaBinding>> {
  const map: Record<string, WorkspaceWizardMediaBinding> = {};
  for (const binding of WORKSPACE_WIZARD_MEDIA_BINDINGS) {
    map[binding.workspaceType as string] = binding;
  }
  return Object.freeze(map);
}

const bindingsByWorkspaceType = buildBindingMap();

export function resolveWizardMediaBinding(
  workspaceType: string
): WorkspaceWizardMediaBinding | undefined {
  return bindingsByWorkspaceType[workspaceType];
}

export function workspaceSupportsWizardMedia(workspaceType: string): boolean {
  return resolveWizardMediaBinding(workspaceType) !== undefined;
}
