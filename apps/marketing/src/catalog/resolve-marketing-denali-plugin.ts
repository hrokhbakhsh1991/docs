/** Denali guest marketing plugin gate — single literal (ADR-MKT-004 interim until catalogUi Track B). */
export function isDenaliMarketingPlugin(pluginId: string): boolean {
  return pluginId === "denali";
}
