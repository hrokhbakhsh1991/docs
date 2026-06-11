import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app-tour/design-tokens",
    "@app-tour/theme-react",
    "@app-tour/ui-primitives",
    "@app-tour/workspace-sdk",
  ],
};

export default withNextIntl(nextConfig);
