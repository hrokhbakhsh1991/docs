import { createPlatformSslCloudflareProvider } from "./platform-ssl-cloudflare.provider.ts";
import { createPlatformSslStubProvider } from "./platform-ssl-stub.provider.ts";
import type { PlatformSslProvider } from "./platform-ssl.types.ts";

export function createPlatformSslProvider(): PlatformSslProvider {
  const kind = (process.env.PLATFORM_SSL_PROVIDER ?? "stub").trim().toLowerCase();
  if (kind === "cloudflare") {
    return createPlatformSslCloudflareProvider();
  }
  return createPlatformSslStubProvider();
}
