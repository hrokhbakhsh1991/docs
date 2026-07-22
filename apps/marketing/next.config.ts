import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { buildMarketingImageRemotePatterns } from "./src/catalog/resolve-marketing-image-hosts";
import { GUEST_TRANSPILE_PACKAGES } from "./src/bootstrap/guest-transpile-packages.generated.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /** Wave C.b — product workspace packages from manifests (see guest-transpile-packages.generated.mjs). */
  transpilePackages: [...GUEST_TRANSPILE_PACKAGES],
  images: {
    remotePatterns: buildMarketingImageRemotePatterns(process.env.MARKETING_IMAGE_REMOTE_HOSTS),
  },
};

export default withNextIntl(nextConfig);
