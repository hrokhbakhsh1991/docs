import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { GUEST_TRANSPILE_PACKAGES } from "./src/bootstrap/guest-transpile-packages.generated.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /**
   * Playwright + local dev: browser on `portal.{club}.localhost:3003` (canonical) or
   * legacy `{club}.portal.localhost:3003`; Next serves `localhost:3003`.
   */
  allowedDevOrigins: [
    "portal.localhost",
    "portal.*.localhost",
    "portal.denali.localhost",
    "*.portal.localhost",
    "portal.denali.club",
    "denali.club",
  ],
  /** Wave C.b — product workspace packages from manifests (see guest-transpile-packages.generated.mjs). */
  transpilePackages: [...GUEST_TRANSPILE_PACKAGES],
};

export default withNextIntl(nextConfig);
