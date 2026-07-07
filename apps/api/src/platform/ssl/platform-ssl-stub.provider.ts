import type { PlatformSslProvider, PlatformSslProvisionResult } from "./platform-ssl.types.ts";

export function createPlatformSslStubProvider(): PlatformSslProvider {
  return {
    async provision(): Promise<PlatformSslProvisionResult> {
      return { ok: true, expiresAt: new Date(Date.now() + 90 * 86400000) };
    },
  };
}
