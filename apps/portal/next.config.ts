import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GUEST_TRANSPILE_PACKAGES } from "./src/bootstrap/guest-transpile-packages.generated.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const appDir = dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:; font-src 'self' data:; media-src 'self' data: blob:",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  /**
   * Playwright + local dev: browser on `portal.{club}.localhost:3003` (canonical) or
   * legacy `{club}.portal.localhost:3003`; Next serves `localhost:3003`.
   */
  allowedDevOrigins: [
    "portal.localhost",
    "portal.*.localhost",
    "portal.denali.localhost",
    "portal.urban.localhost",
    "*.portal.localhost",
    "urban.localhost",
    "portal.denali.club",
    "denali.club",
  ],
  /** Wave C.b — product workspace packages from manifests (see guest-transpile-packages.generated.mjs). */
  transpilePackages: [...GUEST_TRANSPILE_PACKAGES],
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
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
