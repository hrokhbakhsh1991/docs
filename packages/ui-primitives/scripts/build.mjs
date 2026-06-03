import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(packageRoot, "src");
const distDir = path.join(packageRoot, "dist");

function copyCssModules(dir, rel = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = path.join(rel, entry.name);
    const srcPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      copyCssModules(srcPath, relPath);
      continue;
    }
    if (!entry.name.endsWith(".module.css")) {
      continue;
    }
    const destPath = path.join(distDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
}

fs.mkdirSync(distDir, { recursive: true });
copyCssModules(srcDir);
