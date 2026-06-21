export type TenantSitesCheckSurface = {
  readonly ok?: boolean;
};

export type TenantSitesCheckResults = {
  readonly marketing?: TenantSitesCheckSurface;
  readonly portal?: TenantSitesCheckSurface;
  readonly admin?: TenantSitesCheckSurface;
};

export function countUnhealthyFromSitesCheckResults(
  results: TenantSitesCheckResults | undefined
): number {
  if (results === undefined) {
    return 0;
  }
  let unhealthy = 0;
  if (results.marketing?.ok === false) {
    unhealthy += 1;
  }
  if (results.portal?.ok === false) {
    unhealthy += 1;
  }
  if (results.admin?.ok === false) {
    unhealthy += 1;
  }
  return unhealthy;
}

export function countUnhealthyFromSitesCheckBody(body: {
  readonly results?: TenantSitesCheckResults;
}): number {
  return countUnhealthyFromSitesCheckResults(body.results);
}
