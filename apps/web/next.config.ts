import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.VPS_BUILD_IGNORE_TS === "1",
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  transpilePackages: [
    "@app-tour/draft-engine",
    "@app-tour/wizard-navigation",
    "@app-tour/design-tokens",
    "@app-tour/platform-core",
    "@app-tour/theme-react",
    "@app-tour/ui-primitives",
    "@app-tour/workspace-sdk",
    "@app-tour/workspace-starter",
    "@app-tour/workspace-denali",
    "@app-tour/workspace-urban",
  ],
  webpack: (config, { webpack, isServer }) => {
    if (process.env.NEXT_FONT_OFFLINE === "1") {
      const googleFonts = path.join(process.cwd(), "src/i18n/app-fonts.google.ts");
      const offlineFonts = path.join(process.cwd(), "src/i18n/app-fonts.offline.ts");
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        [googleFonts]: offlineFonts,
      };
    }
    if (!isServer) {
      // Client never bundles Node minio; Denali web uses `@app-tour/workspace-denali/plugin` only.
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^minio$/,
        })
      );
      if (process.env.ALLOW_DENALI_WEB_PLUGIN !== "true") {
        config.plugins.push(
          new webpack.IgnorePlugin({
            resourceRegExp: /^@app-tour\/workspace-denali$/,
          })
        );
      }
      if (process.env.ALLOW_URBAN_WEB_PLUGIN !== "true") {
        config.plugins.push(
          new webpack.IgnorePlugin({
            resourceRegExp: /^@app-tour\/workspace-urban$/,
          })
        );
      }
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
