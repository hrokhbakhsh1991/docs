import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Free a TCP port — fuser when present, else ss pid parse (Cloud VM lacks fuser). */
export function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
    return;
  } catch {
    // fuser missing or port already free
  }

  try {
    const out = execSync(`ss -tlnp sport = :${port}`, { encoding: "utf8" });
    const pidMatch = out.match(/pid=(\d+)/);
    if (pidMatch) {
      execSync(`kill ${pidMatch[1]}`, { stdio: "ignore" });
      return;
    }
  } catch {
    // ss unavailable — fall through to netstat
  }

  try {
    const out = execSync(`netstat -tlnp 2>/dev/null | grep ":${port} "`, { encoding: "utf8" });
    const pidMatch = out.match(/(\d+)\/node/);
    if (pidMatch) {
      execSync(`kill ${pidMatch[1]}`, { stdio: "ignore" });
    }
  } catch {
    // port free or netstat unavailable
  }
}

/** Drop stale Next dev vendor chunks before certification boot (prevents ENOENT 500s). */
export function cleanNextDevCache(appDir) {
  const nextDir = path.join(appDir, ".next");
  if (!fs.existsSync(nextDir)) {
    return;
  }
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `smoke-cert-server-utils: could not clean ${nextDir}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
