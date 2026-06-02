#!/usr/bin/env node
/**
 * Build harness, serve statically, run memlab traversal scenario (step 1 → 7 → 1).
 */
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, "dist-memlab");
const SCENARIO = path.join(
  WEB_ROOT,
  "src/features/tours/wizard/denali/__benchmarks__/denali-wizard-traversal.scenario.cjs",
);
const PORT = Number(process.env.DENALI_MEMLAB_PORT ?? "8765");
const WORK_DIR = path.join(WEB_ROOT, ".memlab");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: WEB_ROOT,
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function serveStatic(rootDir, port) {
  const server = http.createServer((req, res) => {
    const urlPath = req.url?.split("?")[0] ?? "/";
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(rootDir, rel);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const ext = path.extname(filePath);
    const type =
      ext === ".html" ? "text/html" : ext === ".js" ? "application/javascript" : "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.end(fs.readFileSync(filePath));
  });

  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function main() {
  run("node", ["scripts/build-denali-memlab-harness.mjs"]);

  fs.mkdirSync(WORK_DIR, { recursive: true });

  const server = await serveStatic(OUT_DIR, PORT);
  process.env.DENALI_MEMLAB_PORT = String(PORT);

  let memlabExit = 1;
  try {
    const memlab = spawn(
      "pnpm",
      ["exec", "memlab", "run", "--scenario", SCENARIO, "--work-dir", WORK_DIR, "--skip-screenshot"],
      {
        cwd: WEB_ROOT,
        env: { ...process.env, DENALI_MEMLAB_PORT: String(PORT) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let output = "";
    memlab.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    });
    memlab.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stderr.write(text);
    });

    memlabExit = await new Promise((resolve) => {
      memlab.on("close", (code) => resolve(code ?? 1));
    });

    if (memlabExit !== 0) {
      console.error("memlab run exited with code", memlabExit);
      process.exit(memlabExit);
    }

    const leakSignals = [
      /leak detected/i,
      /potential leak/i,
      /retained by/i,
      /Memory leak found/i,
    ];
    const hasLeakSignal = leakSignals.some((pattern) => pattern.test(output));
    if (hasLeakSignal) {
      console.error("memlab: leak indicators found in output");
      process.exit(1);
    }

    console.log("memlab: wizard traversal completed with no leak indicators");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
