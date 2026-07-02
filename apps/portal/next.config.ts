import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /** Playwright + local dev: browser on `{club}.portal.localhost:3003`, Next on `localhost:3003`. */
  allowedDevOrigins: ["portal.localhost", "*.portal.localhost"],
  transpilePackages: [
    "@app-tour/design-tokens",
    "@app-tour/theme-react",
    "@app-tour/ui-primitives",
    "@app-tour/workspace-sdk",
    "@app-tour/workspace-plugin-host",
    "@app-tour/workspace-denali",
    "@app-tour/workspace-urban",
    "@app-tour/catalog-intake-ui",
    "@app-tour/catalog-registration-auth",
    "@app-tour/catalog-registration-flow-ui",
  ],
};

export default withNextIntl(nextConfig);
