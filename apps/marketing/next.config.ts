import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildMarketingImageRemotePatterns } from "./src/catalog/resolve-marketing-image-hosts";
import { GUEST_TRANSPILE_PACKAGES } from "./src/bootstrap/guest-transpile-packages.generated.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const appDir = dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' http: https: 'unsafe-inline'; connect-src 'self' http: https: ws: wss:; font-src 'self' data:; media-src 'self' data: blob:",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  /**
   * Playwright + local marketing: browser on `{club}.localhost:3002`.
   * Next 15+ otherwise blocks non-localhost Host (SMK-MKT / SMK-P8-01).
   */
  allowedDevOrigins: [
    "denali.localhost",
    "urban.localhost",
    "operator.localhost",
    "harbor.localhost",
    "*.localhost",
  ],
  /** Wave C.b — product workspace packages from manifests (see guest-transpile-packages.generated.mjs). */
  transpilePackages: [...GUEST_TRANSPILE_PACKAGES],
  images: {
    remotePatterns: buildMarketingImageRemotePatterns(process.env.MARKETING_IMAGE_REMOTE_HOSTS),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config) => {
    if (process.env.NEXT_FONT_OFFLINE === "1") {
      config.resolve ??= {};
      config.resolve.alias ??= {};
      config.resolve.alias["@/i18n/app-fonts.google"] = resolve(
        appDir,
        "src/i18n/app-fonts.offline.ts"
      );
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
