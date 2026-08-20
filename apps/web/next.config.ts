import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

import { ADMIN_TRANSPILE_PACKAGES } from "./src/bootstrap/admin-transpile-packages.generated.mjs";
import {
  resolveActiveAdminClientWorkspaceIgnoreRules,
  resolveAdminClientWorkspaceBundleEnv,
} from "./src/bootstrap/admin-client-workspace-ignore.generated.mjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  env: resolveAdminClientWorkspaceBundleEnv(process.env),
  /** VPS staging sync (`pnpm run p7:sync-staging-web`) — trunk TS debt; webpack output still valid. */
  typescript: {
    ignoreBuildErrors: process.env.STAGING_WEB_BUILD === "1",
  },
  eslint: {
    ignoreDuringBuilds: process.env.STAGING_WEB_BUILD === "1",
  },
  allowedDevOrigins: [
    "admin.localhost",
    "*.admin.localhost",
    "admin.*.localhost",
    "admin.denali.localhost",
  ],
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
  /** Wave G.a — product workspace packages from manifests (see admin-transpile-packages.generated.mjs).
   * Plus static geocoding landmarks (non-product; dist or src — always transpile for admin BFF). */
  transpilePackages: [
    ...ADMIN_TRANSPILE_PACKAGES,
    "@app-tour/iran-mountain-landmarks",
  ],
  webpack: (config, { webpack, isServer }) => {
    const encounterUiRoot = path.resolve(
      __dirname,
      "../../packages/finance-case-encounter-ui/src/index.ts"
    );
    // Option C — resolve Denali plugin entry from src so native import() survives
    // (dist CJS collapses Pattern B dynamic imports into one mega-chunk).
    // Plugin specifier only — do not alias the whole @app-tour/workspace-denali package.
    const denaliPluginSrc = path.resolve(
      __dirname,
      "../../packages/workspaces/denali/src/denali.plugin.ts"
    );
    // Prefer replacement plugin — alias may already be a webpack5 array on CI.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@app-tour\/finance-case-encounter-ui$/,
        encounterUiRoot
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@app-tour\/workspace-denali\/plugin$/,
        denaliPluginSrc
      )
    );
    if (Array.isArray(config.resolve.alias)) {
      config.resolve.alias.push(
        {
          name: "@app-tour/finance-case-encounter-ui",
          alias: encounterUiRoot,
        },
        {
          name: "@app-tour/workspace-denali/plugin",
          alias: denaliPluginSrc,
        }
      );
    } else {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@app-tour/finance-case-encounter-ui": encounterUiRoot,
        "@app-tour/workspace-denali/plugin": denaliPluginSrc,
      };
    }
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
