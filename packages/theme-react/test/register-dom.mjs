// @ts-check
/// <reference path="./node-module.mock.d.ts" />

import Module from "node:module";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

/** @type {NodeModuleLoaderMock.LoadFn} */
const originalLoad = /** @type {NodeModuleLoaderMock.ModuleConstructor} */ (Module)._load;

/** @type {NodeModuleLoaderMock.LoadFn} */
Module._load = function cssLoad(request, parent, isMain) {
  if (request.endsWith(".css")) {
    return {};
  }
  return originalLoad.call(
    /** @type {NodeModuleLoaderMock.ModuleConstructor} */ (Module),
    request,
    parent,
    isMain,
  );
};

GlobalRegistrator.register();
