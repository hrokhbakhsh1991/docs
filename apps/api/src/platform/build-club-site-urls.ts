import { readPlatformRootDomain } from "./read-platform-root-domain.ts";

/**
 * P1-N-041: Build club site URLs for a tenant.
 * Returns 3 URLs: marketing (apex), portal (.portal.), admin (.admin./auth/login)
 */
export interface ClubSiteUrls {
  readonly marketing: string;
  readonly portal: string;
  readonly admin: string;
}

export function buildClubSiteUrls(subdomain: string): ClubSiteUrls {
  const rootDomain = readPlatformRootDomain();

  // Marketing: https://subdomain.rootdomain.com (apex)
  const marketing = `https://${subdomain}.${rootDomain}`;

  // Portal: https://subdomain.portal.rootdomain.com
  const portal = `https://${subdomain}.portal.${rootDomain}`;

  // Admin: https://subdomain.admin.rootdomain.com/auth/login
  const admin = `https://${subdomain}.admin.${rootDomain}/auth/login`;

  return {
    marketing,
    portal,
    admin,
  };
}

// Made with Bob
