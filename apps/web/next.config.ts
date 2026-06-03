import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app-tour/design-tokens",
    "@app-tour/platform-core",
    "@app-tour/theme-react",
    "@app-tour/ui-primitives",
    "@app-tour/workspace-sdk",
    "@app-tour/workspace-starter",
  ],
};

export default nextConfig;
