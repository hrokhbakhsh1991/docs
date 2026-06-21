"use client";

import { buildClubSitePreviewUrls } from "./build-club-site-preview";

export type StepSitesProps = {
  readonly subdomain: string;
};

export function StepSites({ subdomain }: StepSitesProps) {
  const urls = buildClubSitePreviewUrls(subdomain);

  return (
    <div className="space-y-4" data-step="sites">
      <p className="text-sm text-muted-foreground">
        These URLs will be provisioned for the club subdomain.
      </p>
      <dl className="space-y-3 rounded-lg border border-border p-4 text-sm">
        <div>
          <dt className="font-medium">Marketing</dt>
          <dd className="break-all text-muted-foreground">{urls.marketing}</dd>
        </div>
        <div>
          <dt className="font-medium">Portal</dt>
          <dd className="break-all text-muted-foreground">{urls.portal}</dd>
        </div>
        <div>
          <dt className="font-medium">Admin</dt>
          <dd className="break-all text-muted-foreground">{urls.admin}</dd>
        </div>
      </dl>
    </div>
  );
}
