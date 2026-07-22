import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { ADMIN_TRANSPILE_PACKAGES } from "./src/bootstrap/admin-transpile-packages.generated.mjs";
import { resolveActiveAdminClientWorkspaceIgnoreRules } from "./src/bootstrap/admin-client-workspace-ignore.generated.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /** VPS staging sync (`pnpm run p7:sync-staging-web`) — trunk TS debt; webpack output still valid. */
  typescript: {
    ignoreBuildErrors: process.env.STAGING_WEB_BUILD === "1",
  },
  eslint: {
    ignoreDuringBuilds: process.env.STAGING_WEB_BUILD === "1",
  },
  allowedDevOrigins: ["admin.localhost", "*.admin.localhost"],
  async redirects() {
    // Wave H.i.b — legacy product URL → product-blind owner settings path.
    return [
      {
        source: "/settings/urban",
        destination: "/settings/workspace-owner",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  /** Wave G.a — product workspace packages from manifests (see admin-transpile-packages.generated.mjs). */
  transpilePackages: [...ADMIN_TRANSPILE_PACKAGES],
  webpack: (config, { webpack, isServer }) => {
    if (!isServer) {
      // Client never bundles Node minio SDK.
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^minio$/,
        })
      );
      // Wave H.j — product packages (root + subpaths) stay out of the client graph unless ALLOW_*_WEB_PLUGIN=true (manifest adminWeb.clientBundleEnvGate).
      for (const rule of resolveActiveAdminClientWorkspaceIgnoreRules(process.env)) {
        config.plugins.push(
          new webpack.IgnorePlugin({
            resourceRegExp: rule.resourceRegExp,
          })
        );
      }
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
