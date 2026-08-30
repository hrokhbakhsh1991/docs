// @ts-check
import fs from "node:fs";
import Module from "node:module";

import React from "react";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

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

const originalLoad = Module._load;

Module._load = function cssModuleLoad(request, parent, isMain) {
  if (request.endsWith(".module.css")) {
    const resolved = Module._resolveFilename(request, parent, isMain);
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
  return originalLoad.call(Module, request, parent, isMain);
};

GlobalRegistrator.register();
