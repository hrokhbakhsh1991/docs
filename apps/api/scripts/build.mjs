import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  splitting: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  external: ["@app-tour/*"],
  outdir: "dist",
  entryNames: "main",
  chunkNames: "chunks/[name]-[hash]",
});

await import("./write-dist-package.mjs");
