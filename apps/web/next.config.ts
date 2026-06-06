import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app-tour/design-tokens",
    "@app-tour/platform-core",
    "@app-tour/theme-react",
    "@app-tour/ui-primitives",
    "@app-tour/workspace-sdk",
    "@app-tour/workspace-starter",
    "@app-tour/workspace-denali",
  ],
  webpack: (config, { webpack, isServer }) => {
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
    }
    return config;
  },
};

export default nextConfig;
