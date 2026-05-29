#!/usr/bin/env node
/**
 * Bundle the Denali memlab harness for headless Chrome analysis.
 */
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, "dist-memlab");
const ENTRY = path.join(
  WEB_ROOT,
  "src/features/tours/wizard/denali/__benchmarks__/memlab/main.tsx",
);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(
  path.join(WEB_ROOT, "src/features/tours/wizard/denali/__benchmarks__/memlab/index.html"),
  path.join(OUT_DIR, "index.html"),
);

await esbuild.build({
  absWorkingDir: WEB_ROOT,
  entryPoints: [ENTRY],
  bundle: true,
  outfile: path.join(OUT_DIR, "harness.js"),
  platform: "browser",
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  jsxImportSource: "react",
  sourcemap: false,
  minify: false,
  logLevel: "info",
  loader: {
    ".css": "empty",
  },
  alias: {
    "@": path.join(WEB_ROOT, "src"),
    "@/lib": path.join(WEB_ROOT, "lib"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    {
      name: "denali-memlab-shims",
      setup(build) {
        build.onResolve({ filter: /^next-intl$/ }, () => ({
          path: path.join(WEB_ROOT, "src/features/tours/wizard/denali/__benchmarks__/memlab/shims/next-intl.ts"),
        }));
        build.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: path.join(WEB_ROOT, "src/features/tours/wizard/denali/__benchmarks__/memlab/shims/next-navigation.ts"),
        }));
      },
    },
  ],
});

console.log(`denali memlab harness built → ${OUT_DIR}`);
