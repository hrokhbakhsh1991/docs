import createNextIntlPlugin from "next-intl/plugin";

/** Loads per-request messages and locale from `src/i18n/request.ts` for `next-intl` + App Router. */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@tour/ui", "@repo/shared-rbac"],
  async redirects() {
    return [
      {
        source: "/settings/tour-form-defaults",
        destination: "/settings/tour-presets",
        permanent: true,
      },
      {
        source: "/settings/tour-form-defaults/:path*",
        destination: "/settings/tour-presets",
        permanent: true,
      },
      {
        source: "/bookings/edit/:id",
        destination: "/bookings/:id",
        permanent: true,
      },
    ];
  },
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

export default withNextIntl(nextConfig);
