import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { buildMarketingImageRemotePatterns } from "./src/catalog/resolve-marketing-image-hosts";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app-tour/design-tokens",
    "@app-tour/theme-react",
    "@app-tour/workspace-sdk",
    "@app-tour/workspace-starter",
    "@app-tour/workspace-denali",
    "@app-tour/workspace-urban",
    "@app-tour/workspace-guest-club",
  ],
  images: {
    remotePatterns: buildMarketingImageRemotePatterns(process.env.MARKETING_IMAGE_REMOTE_HOSTS),
  },
};

export default withNextIntl(nextConfig);
