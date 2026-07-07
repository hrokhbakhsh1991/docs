import Module from "node:module";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(join(webRoot, "package.json"));
const canonicalNextIntl = requireFromWeb.resolve("next-intl");

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
