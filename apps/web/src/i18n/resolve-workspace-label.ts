import { WORKSPACE_WIZARD_I18N_NAMESPACES } from "@/bootstrap/wizard-label-bindings.generated";

type WorkspaceTranslateFn = (key: string) => string;

const WORKSPACE_LABEL_NAMESPACES = WORKSPACE_WIZARD_I18N_NAMESPACES.filter(
  (namespace) => namespace !== "wizard"
);

export function resolveWorkspaceLabelFromMessages(
  t: WorkspaceTranslateFn,
  pluginId: string
): string {
  if ((WORKSPACE_LABEL_NAMESPACES as readonly string[]).includes(pluginId)) {
    return t(pluginId);
  }
  return t("default");
}
