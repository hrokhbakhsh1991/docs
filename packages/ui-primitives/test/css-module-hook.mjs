import fs from "node:fs";

/**
 * @param {string} url
 * @param {import('node:module').LoadContext} context
 * @param {import('node:module').LoadFn} nextLoad
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) {
    const filePath = new URL(url).pathname;
    const source = fs.readFileSync(filePath, "utf8");
    const classes = {};
    for (const match of source.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{/g)) {
      classes[match[1]] = match[1];
    }
    return {
      format: "module",
      source: `export default ${JSON.stringify(classes)};`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context, nextLoad);
}
