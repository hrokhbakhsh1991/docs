// @ts-check
/// <reference path="./node-module.mock.d.ts" />

import fs from "node:fs";
import Module from "node:module";

import React from "react";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// tsx may compile nested .tsx via a loader that still emits classic JSX; keep React in scope.
globalThis.React = React;

function extractCssModuleClasses(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const classes = {};
  for (const match of source.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{/g)) {
    classes[match[1]] = match[1];
  }
  return classes;
}

const cssModuleCache = new Map();

/** @type {NodeModuleLoaderMock.LoadFn} */
const originalLoad = /** @type {NodeModuleLoaderMock.ModuleConstructor} */ (Module)._load;

/** @type {NodeModuleLoaderMock.LoadFn} */
Module._load = function cssModuleLoad(request, parent, isMain) {
  if (request.endsWith(".module.css")) {
    const resolved = /** @type {NodeModuleLoaderMock.ModuleConstructor} */ (Module)._resolveFilename(
      request,
      parent,
      isMain,
    );
    if (cssModuleCache.has(resolved)) {
      return cssModuleCache.get(resolved);
    }
    const mod = { default: extractCssModuleClasses(resolved) };
    cssModuleCache.set(resolved, mod);
    return mod;
  }
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
