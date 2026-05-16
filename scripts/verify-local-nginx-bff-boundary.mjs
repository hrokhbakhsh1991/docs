#!/usr/bin/env node
/**
 * Spins up nginx:alpine with local-test conf and verifies /api/v2/ → 403, / → 200.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CONF = path.join(REPO_ROOT, "docs/infrastructure/nginx-bff-ingress.local-test.conf");
const CONTAINER = "tour-ops-nginx-bff-test";
const PORT = process.env.NGINX_TEST_PORT ?? "8888";

function docker(...args) {
  return spawnSync("docker", args, { encoding: "utf8" });
}

function main() {
  docker("rm", "-f", CONTAINER);

  const run = docker("run", "-d", "--name", CONTAINER, "-p", `${PORT}:8888`, "-v", `${CONF}:/etc/nginx/conf.d/default.conf:ro`, "nginx:alpine");
  if (run.status !== 0) {
    console.error("[nginx-local] FAIL — docker run:", run.stderr || run.stdout);
    process.exit(1);
  }

  let ready = false;
  for (let i = 0; i < 20; i += 1) {
    const probe = spawnSync("curl", ["-sf", "-o", "/dev/null", `http://127.0.0.1:${PORT}/`], { encoding: "utf8" });
    if (probe.status === 0) {
      ready = true;
      break;
    }
    spawnSync("sleep", ["0.3"]);
  }
  if (!ready) {
    const logs = docker("logs", CONTAINER);
    console.error("[nginx-local] FAIL — nginx not ready:", logs.stderr || logs.stdout);
    docker("rm", "-f", CONTAINER);
    process.exit(1);
  }

  try {
    const block = spawnSync("curl", ["-sf", "-o", "/dev/null", "-w", "%{http_code}", `http://127.0.0.1:${PORT}/api/v2/health`], {
      encoding: "utf8",
    });
    const allow = spawnSync("curl", ["-sf", "-o", "/dev/null", "-w", "%{http_code}", `http://127.0.0.1:${PORT}/`], {
      encoding: "utf8",
    });

    const blockCode = block.stdout?.trim();
    const allowCode = allow.stdout?.trim();

    if (blockCode !== "403") {
      console.error(`[nginx-local] FAIL — /api/v2/ expected 403, got ${blockCode}`);
      process.exit(1);
    }
    if (allowCode !== "200") {
      console.error(`[nginx-local] FAIL — / expected 200, got ${allowCode}`);
      process.exit(1);
    }

    console.log(`[nginx-local] OK — /api/v2/ → 403, / → 200 (port ${PORT})`);
  } finally {
    docker("rm", "-f", CONTAINER);
  }
}

main();
