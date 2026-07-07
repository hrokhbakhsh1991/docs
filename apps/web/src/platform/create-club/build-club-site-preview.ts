export type ClubSitePreviewUrls = {
  readonly marketing: string;
  readonly portal: string;
  readonly admin: string;
};

export function readPlatformRootDomainClient(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/^\.+|\.+$/g, "");
  }
  return "localhost";
}

export function buildClubSitePreviewUrls(subdomain: string): ClubSitePreviewUrls {
  const club = subdomain.trim().toLowerCase();
  const root = readPlatformRootDomainClient();
  return {
    marketing: `https://${club}.${root}`,
    portal: `https://${club}.portal.${root}`,
    admin: `https://${club}.admin.${root}/auth/login`,
  };
}
