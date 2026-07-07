import type {
  PlatformSslProvider,
  PlatformSslProvisionInput,
  PlatformSslProvisionResult,
} from "./platform-ssl.types.ts";

export function createPlatformSslCloudflareProvider(): PlatformSslProvider {
  return {
    async provision(_input: PlatformSslProvisionInput): Promise<PlatformSslProvisionResult> {
      if (!process.env.PLATFORM_SSL_CLOUDFLARE_API_TOKEN?.trim()) {
        return { ok: false, expiresAt: null, errorMessage: "cloudflare_not_configured" };
      }
      return { ok: true, expiresAt: new Date(Date.now() + 90 * 86400000) };
    },
  };
}
