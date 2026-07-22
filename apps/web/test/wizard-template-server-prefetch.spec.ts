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

  it("WIZARD-02 new tour client forwards server prefetch and skips duplicate gate fetch", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/new-tour-wizard-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialTemplateResponse/);
    assert.match(clientSource, /initialLocationsResponse/);
    assert.match(clientSource, /OperatorCreateTourWizardClient/);

    const denaliClientSource = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/create-tour-wizard-client.tsx"),
      "utf8"
    );
    assert.match(denaliClientSource, /OperatorCreateTourWizardCatalogShell/);
    assert.match(denaliClientSource, /initialLocationsResponse/);

    const readySource = readFileSync(
      resolve(WEB_ROOT, "app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    assert.match(readySource, /ensureWizardHostAdapters/);
    assert.match(readySource, /resolveWizardCatalogPrefetchProvider/);

    const gateSource = readFileSync(
      resolve(WEB_ROOT, "src/tours/wizard-create-template-gate.ts"),
      "utf8"
    );
    assert.match(gateSource, /skipInitialGateFetchRef/);
    assert.match(gateSource, /initialTemplateResponse/);
  });

  it("WIZARD-03 new tour page prefetches locations catalog on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/tours/new/page.tsx"), "utf8");
    assert.match(pageSource, /fetchWizardLocationsServer/);
    assert.match(pageSource, /initialLocationsResponse/);
  });

  it("WIZARD-04 destination catalog hook skips first fetch when prefetched", () => {
    const packageHook = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/workspaces/denali/src/ui/hooks/use-destination-catalog.ts"
      ),
      "utf8"
    );
    assert.match(packageHook, /skipInitialFetchRef/);
    assert.match(packageHook, /useDenaliWizardCatalogPrefetch/);
    assert.match(packageHook, /fetchDenaliDestinationCatalogClient/);
  });


  it("WIZARD-05 flat edit page prefetches locations catalog on the server", () => {
    const pageSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/page.tsx"),
      "utf8"
    );
    assert.match(pageSource, /fetchWizardLocationsServer/);
    assert.match(pageSource, /initialLocationsResponse/);
  });

  it("WIZARD-06 flat edit router forwards prefetched locations to denali shell", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/tours/[id]/edit/tour-edit-page-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialLocationsResponse/);
    assert.match(clientSource, /TourEditCatalogPrefetchShell|ensureWizardHostAdapters/);
    assert.match(clientSource, /OperatorFlatEditPageClient/);
  });

  it("WIZARD-07 settings template page prefetches template + catalog on the server", () => {
    const pageSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/tour-wizard-template/page.tsx"),
      "utf8"
    );
    assert.match(pageSource, /fetchWizardTemplateServer/);
    assert.match(pageSource, /initialTemplateResponse/);
    assert.match(pageSource, /initialCatalog/);
    assert.match(pageSource, /buildWizardTemplateCatalogFromPlugin/);
  });

  it("WIZARD-08 settings template client skips first fetch when initialTemplateResponse is provided", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/tour-wizard-template/wizard-template-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialTemplateResponse/);
    assert.match(clientSource, /initialCatalog/);
    assert.match(clientSource, /skipInitialTemplateFetchRef/);
    assert.match(clientSource, /ensureWizardTemplateEditor/);
    assert.doesNotMatch(clientSource, /pluginId\s*===\s*["']denali["']/);
    assert.doesNotMatch(clientSource, /@app-tour\/workspace-denali/);
  });
});
