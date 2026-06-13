import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";

/** CI runs production Next servers; dev first-compile exceeds Playwright goto budgets. */
export function isSmokeProdStartEnv() {
  return (
    process.env.SMOKE_USE_PROD_START === "1" ||
    process.env.CI === "true" ||
    process.env.CI === "1"
  );
}

export function parseBootstrapJwtLines(stdout) {
  const env = {};
  for (const line of stdout.split("\n")) {
    if (line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).replace(/\\n/g, "\n");
    }
    env[key] = val;
  }
  return env;
}

/** GHA smoke has no apps/api/.env.local — ephemeral RS256 keys for verify-otp/session JWT. */
export function ensureSmokeJwtEnv(repoRoot, baseEnv) {
  if (baseEnv.AUTH_JWT_PRIVATE_KEY?.trim()) {
    return baseEnv;
  }
  const result = spawnSync("pnpm", ["--filter", "@apps/api", "run", "bootstrap:dev-jwt"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return { ...baseEnv, ...parseBootstrapJwtLines(result.stdout) };
}

export function ensurePackageBuild(repoRoot, packageName, buildIdRelativePath) {
  if (!isSmokeProdStartEnv()) {
    return;
  }
  if (existsSync(path.join(repoRoot, buildIdRelativePath))) {
    return;
  }
  const build = spawnSync("pnpm", ["--filter", `${packageName}...`, "run", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

export function webJwtPublicEnv(apiEnv) {
  return {
    AUTH_JWT_PUBLIC_KEY: apiEnv.AUTH_JWT_PUBLIC_KEY,
    AUTH_JWT_ISSUER: apiEnv.AUTH_JWT_ISSUER ?? "tour-ops",
    AUTH_JWT_AUDIENCE: apiEnv.AUTH_JWT_AUDIENCE ?? "tour-ops-api",
  };
}

export function smokeWebBaseEnv(apiEnv, overrides = {}) {
  return {
    SESSION_COOKIE_SECURE: "false",
    ...webJwtPublicEnv(apiEnv),
    ALLOW_DEV_WEB_SESSION: "true",
    ...overrides,
  };
}

export function waitForUrl(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-ci-env: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}
