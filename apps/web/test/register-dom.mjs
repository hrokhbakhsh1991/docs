import Module from "node:module";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(join(webRoot, "package.json"));
const canonicalNextIntl = requireFromWeb.resolve("next-intl");

// Unit tests load gated workspace plugins via workspace-plugin-loaders.generated.ts.
// Default the manifest clientBundleEnvGate flags so specs exercise import paths; leave
// explicit process.env overrides intact (Wave H fail-closed contract still unit-tested).
for (const key of ["ALLOW_DENALI_WEB_PLUGIN", "ALLOW_URBAN_WEB_PLUGIN"]) {
  if (process.env[key] === undefined) {
    process.env[key] = "true";
  }
}

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request.endsWith(".css")) {
    return {};
  }
  if (request === "next-intl" || request.startsWith("next-intl/")) {
    const resolved =
      request === "next-intl" ? canonicalNextIntl : requireFromWeb.resolve(request);
    return originalLoad.call(Module, resolved, parent, isMain);
  }
  return originalLoad.call(Module, request, parent, isMain);
};

GlobalRegistrator.register();
