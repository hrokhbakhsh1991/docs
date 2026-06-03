/**
 * Child process: require workspace-sdk barrel and fail if @casl/ability entered require.cache.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.join(__dirname, "..");
const require = createRequire(import.meta.url);

require(path.join(SDK_ROOT, "dist", "index.js"));

const CASL_PATTERN = /[/\\]@casl[/\\]ability[/\\]/;
const caslEntries = Object.keys(require.cache).filter((key) => CASL_PATTERN.test(key));

if (caslEntries.length > 0) {
  console.error("Import purity: @casl/ability loaded on barrel import:");
  for (const key of caslEntries) {
    console.error(`  ${key}`);
  }
  process.exit(1);
}

console.log("PURE_BARREL_OK");
