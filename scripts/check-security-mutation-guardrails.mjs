#!/usr/bin/env node
/**
 * Security guardrails: mutation routes must carry explicit auth/RBAC-related guards.
 * Deterministic static scan of Nest controllers (no TypeScript compiler).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportAndExit, reportFatal } from "./guardrail-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ALLOWLIST_PATH = path.join(__dirname, "security-mutation-guardrails.allowlist.json");

function readAllowlist() {
  const raw = fs.readFileSync(ALLOWLIST_PATH, "utf8");
  return JSON.parse(raw);
}

function normPosix(p) {
  return p.split(path.sep).join("/");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, acc);
    } else if (ent.isFile() && ent.name.endsWith("controller.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function extractUseGuardIdentifiers(text) {
  const ids = [];
  const re = /@UseGuards\s*\(\s*([^)]*)\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (t) ids.push(t);
    }
  }
  return ids;
}

function findClosingBraceLine(lines, openLineIdx) {
  let depth = 0;
  let started = false;
  for (let j = openLineIdx; j < lines.length; j++) {
    const line = lines[j];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
        if (started && depth === 0) return j;
      }
    }
  }
  return lines.length - 1;
}

function splitNestControllerClasses(source, rel) {
  const lines = source.split("\n");
  const segments = [];
  let preambleStart = 0;
  const classDecl = /^export class (\w+)\s*\{/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(classDecl);
    if (!m) continue;
    const name = m[1];
    if (!name.endsWith("Controller")) continue;
    const preamble = lines.slice(preambleStart, i).join("\n");
    const endLine = findClosingBraceLine(lines, i);
    segments.push({
      name,
      relPath: rel,
      preambleGuards: extractUseGuardIdentifiers(preamble),
      bodyLines: lines.slice(i + 1, endLine),
      bodyStartIndex: i + 1
    });
    preambleStart = endLine + 1;
    i = endLine;
  }
  return segments;
}

function collectDecoratorBlockLines(lines, asyncLineIndex) {
  const block = [];
  for (let k = asyncLineIndex - 1; k >= 0; k--) {
    const line = lines[k];
    if (/^\s*@\w/.test(line)) {
      block.unshift(line);
      continue;
    }
    if (line.trim() === "") continue;
    break;
  }
  return block;
}

function decoratorBlockHasMutation(decoratorLines) {
  const joined = decoratorLines.join("\n");
  return /@(Post|Put|Patch|Delete)\s*\(/.test(joined);
}

function decoratorBlockHasCheckAbilities(decoratorLines) {
  return decoratorLines.some((line) => line.includes("@CheckAbilities"));
}

function mutationPolicyOk(guardIds, decoratorLines, relPath, methodName, allow) {
  const set = new Set(guardIds);
  const has = (id) => set.has(id);
  const hasAbilitiesStack =
    has("DraftEngineAbilitiesGuard") ||
    (has("AbilitiesGuard") && has("CaslMirrorAbilitiesGuard"));

  if (allow.methodsAllowingThrottlerOnly[relPath]?.includes(methodName)) {
    return has("ThrottlerGuard");
  }
  if (allow.methodsAllowingAuthorizationPresenceOnly[relPath]?.includes(methodName)) {
    return has("AuthorizationPresenceGuard");
  }
  if (has("InternalApiKeyGuard")) return true;
  if (has("PaymentWebhookSignatureGuard")) return true;
  if (!has("AuthorizationPresenceGuard")) return false;

  if (has("RolesGuard")) {
    return (
      hasAbilitiesStack &&
      (has("DraftEngineAbilitiesGuard") || decoratorBlockHasCheckAbilities(decoratorLines))
    );
  }

  return hasAbilitiesStack && decoratorBlockHasCheckAbilities(decoratorLines);
}

function checkMutationGuards(allow) {
  const modulesRoot = path.join(REPO_ROOT, "apps/api/src/modules");
  const excluded = new Set(allow.filesExcludedFromMutationRbacCheck.map(normPosix));
  const violations = [];

  for (const abs of walk(modulesRoot)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (excluded.has(rel)) continue;

    const source = fs.readFileSync(abs, "utf8");
    const segments = splitNestControllerClasses(source, rel);

    for (const seg of segments) {
      const { bodyLines, preambleGuards } = seg;
      for (let li = 0; li < bodyLines.length; li++) {
        const line = bodyLines[li];
        const am = line.match(/^\s*async\s+(\w+)\s*\(/);
        if (!am) continue;
        const methodName = am[1];
        const globalLineHint = `${rel}:${seg.bodyStartIndex + li + 1}`;
        const decorators = collectDecoratorBlockLines(bodyLines, li);
        if (!decoratorBlockHasMutation(decorators)) continue;

        const methodGuardIds = extractUseGuardIdentifiers(decorators.join("\n"));
        const merged = [...preambleGuards, ...methodGuardIds];

        if (!mutationPolicyOk(merged, decorators, rel, methodName, allow)) {
          violations.push(
            `${rel} (${methodName}): mutation route must use AuthorizationPresenceGuard + RolesGuard + AbilitiesGuard + ` +
              `CaslMirrorAbilitiesGuard + @CheckAbilities (or InternalApiKeyGuard, or PaymentWebhookSignatureGuard, or allowlist). ` +
              `Guards seen: ${merged.length ? merged.join(", ") : "(none)"}. (${globalLineHint})`
          );
        }
      }
    }
  }

  return violations;
}

function main() {
  let allow;
  try {
    allow = readAllowlist();
  } catch (e) {
    reportFatal("check-security-mutation-guardrails", e);
  }

  const violations = checkMutationGuards(allow);
  reportAndExit("check-security-mutation-guardrails", violations);
}

try {
  main();
} catch (err) {
  reportFatal("check-security-mutation-guardrails", err);
}
