/**
 * Phase 6 gate graph regression — residual apps-cert shape.
 *
 * Asserts package.json `phase-6:gate` uses residual post-test + floors,
 * not bare `phase-3:apps-cert` or nested `phase-5:gate`.
 *
 * @see docs/phase-3/phase-3-guard-apps-cert-split.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

/**
 * Strip residual suffixes so a leftover bare `phase-3:apps-cert` is detectable.
 * @param {string} gateCmd
 */
export function stripResidualAppsCertTokens(gateCmd) {
  return String(gateCmd)
    .replaceAll("phase-3:apps-cert:post-test", "")
    .replaceAll("phase-3:apps-cert:floors", "");
}

/**
 * @param {string} [gateCmd] — defaults to package.json scripts["phase-6:gate"]
 * @returns {{ ok: boolean, detail: string | null, gateCommand: string, appsCert: object }}
 */
export function evaluatePhase6GateGraph(gateCmd) {
  const pkgPath = path.join(REPO_ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const cmd = gateCmd ?? pkg.scripts?.["phase-6:gate"] ?? "";

  const failures = [];

  if (!cmd.includes("phase-3:apps-cert:post-test")) {
    failures.push("phase-6:gate must include phase-3:apps-cert:post-test");
  }
  if (!cmd.includes("phase-3:apps-cert:floors")) {
    failures.push("phase-6:gate must include phase-3:apps-cert:floors");
  }

  const stripped = stripResidualAppsCertTokens(cmd);
  if (stripped.includes("phase-3:apps-cert")) {
    failures.push("phase-6:gate must not include bare phase-3:apps-cert");
  }
  if (/\bphase-5:gate\b/.test(cmd)) {
    failures.push("phase-6:gate must not include phase-5:gate");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length === 0 ? null : failures.join("; "),
    gateCommand: cmd,
    appsCert: {
      appsCertMode: "residual",
      fullAppsCert: false,
      owned: ["post-test", "floors"],
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = evaluatePhase6GateGraph();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
