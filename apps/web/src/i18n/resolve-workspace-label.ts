type WorkspaceTranslateFn = (key: "denali" | "urban" | "default") => string;

export function resolveWorkspaceLabelFromMessages(
  t: WorkspaceTranslateFn,
  pluginId: string
): string {
  if (pluginId === "denali") {
    return t("denali");
  }
  if (pluginId === "urban") {
    return t("urban");
  }
  return t("default");
}
