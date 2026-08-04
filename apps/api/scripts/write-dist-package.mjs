#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(
  path.join(apiRoot, "dist", "package.json"),
  `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`
);
