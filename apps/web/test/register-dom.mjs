import Module from "node:module";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

const originalLoad = Module._load;

Module._load = function cssLoad(request, parent, isMain) {
  if (request.endsWith(".css")) {
    return {};
  }
  return originalLoad.call(Module, request, parent, isMain);
};

GlobalRegistrator.register();
