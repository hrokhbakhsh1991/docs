/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@tour/ui"],
  /**
   * Avoid dev-only "Cannot find module './NNN.js'" when webpack disk cache / chunks
   * drift after fast refresh (stale .next referenced chunks).
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
