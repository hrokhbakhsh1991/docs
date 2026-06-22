import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(packageRoot, "src");
const distDir = path.join(packageRoot, "dist");

function copyDir(relativeDir) {
  const from = path.join(srcDir, relativeDir);
  const to = path.join(distDir, relativeDir);
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(path.join(relativeDir, entry.name));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// TypeScript emit goes to dist/ via tsc after this script; only remove CSS artifacts we own.
if (fs.existsSync(distDir)) {
  const generatedDist = path.join(distDir, "generated");
  if (fs.existsSync(generatedDist)) {
    fs.rmSync(generatedDist, { recursive: true, force: true });
  }
  for (const name of ["index.css", "primitives.css", "semantics.css"]) {
    const filePath = path.join(distDir, name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  const themesDist = path.join(distDir, "themes");
  if (fs.existsSync(themesDist)) {
    fs.rmSync(themesDist, { recursive: true, force: true });
  }
}
fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(path.join(srcDir, "index.css"), path.join(distDir, "index.css"));
fs.copyFileSync(path.join(srcDir, "guest-shell.css"), path.join(distDir, "guest-shell.css"));
fs.copyFileSync(path.join(srcDir, "shell-bridge.css"), path.join(distDir, "shell-bridge.css"));
fs.copyFileSync(path.join(srcDir, "primitives.css"), path.join(distDir, "primitives.css"));
fs.copyFileSync(path.join(srcDir, "semantics.css"), path.join(distDir, "semantics.css"));
copyDir("themes");
