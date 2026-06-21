import { fetchPlatformApi } from "../platform-api-client";

export async function downloadTenantGdprExport(tenantId: string): Promise<void> {
  const response = await fetchPlatformApi(`/tenants/${tenantId}/export`, {
    method: "POST",
    body: "{}",
  });
  if (!response.ok) throw new Error("export_failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tenant-${tenantId}-gdpr-export.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}
