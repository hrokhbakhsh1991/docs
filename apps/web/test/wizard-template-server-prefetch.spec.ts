import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("wizard-template-server-prefetch.spec.ts", () => {
  it("WIZARD-01 new tour page prefetches template gate on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/tours/new/page.tsx"), "utf8");
    assert.match(pageSource, /fetchWizardTemplateServer/);
    assert.match(pageSource, /initialTemplateResponse/);
  });

  it("WIZARD-02 wizard client skips first gate fetch when initialTemplateResponse is provided", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/new-tour-wizard-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialTemplateResponse/);
    assert.match(clientSource, /skipInitialGateFetchRef/);
    assert.match(clientSource, /initialLocationsResponse/);
    assert.match(clientSource, /DenaliWizardCatalogPrefetchProvider/);
  });

  it("WIZARD-03 new tour page prefetches locations catalog on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/tours/new/page.tsx"), "utf8");
    assert.match(pageSource, /fetchWizardLocationsServer/);
    assert.match(pageSource, /initialLocationsResponse/);
  });

  it("WIZARD-04 destination catalog hook skips first fetch when prefetched", () => {
    const hookSource = readFileSync(
      resolve(WEB_ROOT, "src/wizard/denali/use-denali-destination-catalog.ts"),
      "utf8"
    );
    assert.match(hookSource, /skipInitialFetchRef/);
    assert.match(hookSource, /useDenaliWizardCatalogPrefetch/);
    assert.match(hookSource, /fetchDenaliDestinationCatalogClient/);
  });

  it("WIZARD-05 flat edit page prefetches locations catalog on the server", () => {
    const pageSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/page.tsx"),
      "utf8"
    );
    assert.match(pageSource, /fetchWizardLocationsServer/);
    assert.match(pageSource, /initialLocationsResponse/);
  });

  it("WIZARD-06 flat edit client wraps destination catalog prefetch provider", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /DenaliWizardCatalogPrefetchProvider/);
    assert.match(clientSource, /initialLocationsResponse/);
  });
});
