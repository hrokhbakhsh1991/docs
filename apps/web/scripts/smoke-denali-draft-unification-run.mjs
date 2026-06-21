#!/usr/bin/env node
/**
 * One-shot denali draft unification smoke: start memory servers, run probes, shutdown.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.dirname(fileURLToPath(import.meta.url));
const serversScript = path.join(webDir, "smoke-denali-draft-unification-servers.mjs");
const smokeScript = path.join(webDir, "denali-draft-unification-smoke.mjs");

function waitForUrl(url, timeoutMs = 240_000) {
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
        reject(new Error(`smoke-denali-draft-unification-run: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function probeOtp() {
  return new Promise((resolve) => {
    const body = JSON.stringify({ phone: process.env.OPERATOR_OWNER_MOBILE ?? "+989121000001" });
    const req = http.request(
      {
        method: "POST",
        hostname: "127.0.0.1",
        port: 3000,
        path: "/api/auth/request-otp",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          host: "denali.localhost:3000",
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }
    );
    req.on("error", () => resolve(0));
    req.write(body);
    req.end();
  });
}

const servers = spawn("node", [serversScript], {
  cwd: webDir,
  env: process.env,
  stdio: "inherit",
});

let smokeExit = 1;

try {
  await waitForUrl("http://127.0.0.1:3001/health");
  await waitForUrl("http://127.0.0.1:3000/health");
  const otpStatus = await probeOtp();
  if (otpStatus !== 200) {
    throw new Error(
      `BFF request-otp returned ${otpStatus} — check Next compile logs on :3000 (restart dev web after pull)`
    );
  }
  await new Promise((r) => setTimeout(r, 1_000));

  smokeExit = await new Promise((resolve) => {
    const smoke = spawn("node", [smokeScript], {
      cwd: webDir,
      env: process.env,
      stdio: "inherit",
    });
    smoke.on("exit", (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  servers.kill("SIGTERM");
}

process.exit(smokeExit);
