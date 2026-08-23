#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const surface = process.argv[2];
const baseUrl = process.env[`${surface.toUpperCase()}_BASE_URL`];
const report = { schemaVersion: 1, surface, mode: "read-only", startedAt: new Date().toISOString() };
if (!baseUrl) {
  report.status = "SKIP";
  report.reason = `${surface.toUpperCase()}_BASE_URL is not configured`;
} else {
  const url = new URL("/health", baseUrl);
  report.url = url.toString();
  report.status = await new Promise((resolve) => {
    const request = url.protocol === "http:" ? httpRequest : httpsRequest;
    const req = request(url, { method: "GET", timeout: 10_000 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400 ? "PASS" : "FAIL");
    });
    req.on("error", () => resolve("FAIL"));
    req.on("timeout", () => { req.destroy(); resolve("FAIL"); });
    req.end();
  });
}
report.finishedAt = new Date().toISOString();
const path = process.env.SMOKE_REPORT ?? join(root, `.artifacts/gates/${surface}-smoke.json`);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
console.log(`smoke:${surface}: ${report.status} — ${path}`);
process.exit(report.status === "FAIL" ? 1 : 0);
