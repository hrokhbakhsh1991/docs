import {
  isWorkspaceWizardI18nNamespace,
  listWorkspaceWizardI18nNamespaces,
} from "@/bootstrap/wizard-i18n-translator-hooks.generated";

type WorkspaceTranslateFn = (key: string) => string;

const WORKSPACE_LABEL_NAMESPACES = listWorkspaceWizardI18nNamespaces().filter(
  (namespace) => namespace !== "wizard"
);

export function resolveWorkspaceLabelFromMessages(
  t: WorkspaceTranslateFn,
  pluginId: string
): string {
  if (
    isWorkspaceWizardI18nNamespace(pluginId) &&
    (WORKSPACE_LABEL_NAMESPACES as readonly string[]).includes(pluginId)
  ) {
    return t(pluginId);
  }
  return t("default");
}
