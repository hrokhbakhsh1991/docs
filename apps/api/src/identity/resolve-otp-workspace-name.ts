import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";

/** Read the workspace display name configured through Admin for OTP delivery. */
export async function resolveOtpWorkspaceName(tenantId: string): Promise<string | null> {
  try {
    const tenant = await resolveRegisteredTenantById(tenantId);
    const theme = tenant?.theme;
    const candidates = [theme?.displayName, theme?.displayNameEn, theme?.displayNameFa];
    return (
      candidates
        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?.trim() ?? null
    );
  } catch {
    return null;
  }
}
