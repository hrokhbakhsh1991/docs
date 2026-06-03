import fs from "node:fs";

/**
 * @param {string} url
 * @param {import('node:module').LoadContext} context
 * @param {import('node:module').LoadFn} nextLoad
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) {
    return {
      format: "module",
      source: "export default undefined;",
      shortCircuit: true,
    };
  }
  return nextLoad(url, context, nextLoad);
}
