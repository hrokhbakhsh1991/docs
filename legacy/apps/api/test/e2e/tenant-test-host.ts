/**
 * `Host` header for API tests when `TENANT_ROOT_DOMAIN` defaults to `localhost`
 * (see `bootstrap.ts` / `.env.test`).
 */
export function tenantTestHost(slug: string): string {
  return `${slug}.localhost`;
}
