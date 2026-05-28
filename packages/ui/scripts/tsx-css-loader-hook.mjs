/**
 * Node ESM loader: stub `.css` / `.module.css` so tsx can import @tour/ui without parsing CSS.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith(".css") || url.endsWith(".module.css")) {
    const isModuleCss = url.includes(".module.");
    return {
      format: "module",
      shortCircuit: true,
      source: isModuleCss
        ? "const styles = {}; export default styles;"
        : "export {};",
    };
  }
  return nextLoad(url, context);
}
