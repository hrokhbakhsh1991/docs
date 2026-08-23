#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const rootPackage = readJson("package.json");
const apiPackage = readJson("apps/api/package.json");
const filesUnder = (dir, suffixes = "") => {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ["node_modules", "legacy", "TEMP"].includes(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (!suffixes || (Array.isArray(suffixes) ? suffixes.some((suffix) => entry.name.endsWith(suffix)) : entry.name.endsWith(suffixes))) out.push(relative(root, path));
    }
  };
  walk(absolute);
  return out;
};
const sourceFiles = [...filesUnder("scripts", [".mjs", ".js", ".sh"]), ...filesUnder(".github", [".yml", ".yaml"]), "package.json", "apps/api/package.json"];
const texts = Object.fromEntries(sourceFiles.map((path) => [path, readFileSync(join(root, path), "utf8")]));
const exactRefs = (text) => [...text.matchAll(/pnpm run ([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
const callGraph = Object.fromEntries([...new Set([...Object.keys(rootPackage.scripts), ...Object.keys(apiPackage.scripts)])].map((name) => [name, []]));
for (const [source, value] of Object.entries(texts)) {
  for (const target of exactRefs(value)) {
    if (callGraph[target] && !callGraph[target].includes(source)) callGraph[target].push(source);
  }
}
const consumersOf = (name) => callGraph[name] ?? [];
const classify = (name, command) => ({
  owner: name.startsWith("guard:") || name.startsWith("phase-") ? "platform" : name.startsWith("db:") ? "data" : name.startsWith("smoke:") || name.includes("staging") || name.includes("production") ? "release" : "tooling",
  tier: name.startsWith("pre-commit") ? "L0" : name.startsWith("verify:pr") ? "L1" : name.startsWith("verify:main") ? "L2" : name.includes("release") || name.includes("phase-5") || name.includes("phase-6") ? "L3" : name.includes("staging") ? "L4" : name.includes("production") ? "L5" : "migration",
  sideEffects: /docker|migrate|reset|deploy|up\b|down\b|write|generate/i.test(command) ? "potential-side-effect" : "none",
});
const inventory = (scripts, packageName) => Object.entries(scripts).map(([name, command]) => ({ package: packageName, name, executable: !name.startsWith("//"), command, ...classify(name, command), consumers: consumersOf(name) }));
const workflows = filesUnder(".github/workflows", [".yml", ".yaml"]).map((path) => {
  const text = texts[path] ?? readFileSync(join(root, path), "utf8");
  const id = path.split("/").at(-1).replace(/\.(yml|yaml)$/, "");
  const classification = /workflow_call:/m.test(text) ? "reusable" : /deploy|staging/.test(id) ? "deploy" : /nightly|monthly/.test(id) ? "scheduled" : /create-pr/.test(id) ? "deprecated-manual" : /archive|deprecated/.test(id) ? "archive-candidate" : "canonical";
  return { path, id, classification, jobs: [...text.matchAll(/^  ([\w-]+):/gm)].map((m) => m[1]), usesSetupPlatform: text.includes("./.github/actions/setup-platform"), pathFilters: [...text.matchAll(/^\s+-\s+([^\s#]+(?:\*\*|\/)[^\s#]*)\s*$/gm)].map((m) => m[1]), requiredNames: [...text.matchAll(/name:\s*([^\n]+)/g)].map((m) => m[1].trim()) };
});
const all = [...inventory(rootPackage.scripts, "root"), ...inventory(apiPackage.scripts, "apps/api")];
const executable = all.filter((item) => item.executable);
const duplicateBodies = Object.entries(Object.groupBy(executable, (item) => item.command)).filter(([, items]) => items.length > 1).map(([command, items]) => ({ command, scripts: items.map((item) => `${item.package}:${item.name}`) }));
const dependencies = Object.fromEntries(all.map((item) => [`${item.package}:${item.name}`, exactRefs(item.command).filter((target) => callGraph[target]) ]));
const recursion = Object.entries(dependencies).filter(([source, targets]) => targets.some((target) => source.endsWith(`:${target}`))).map(([source]) => source);
const executableNames = new Set(executable.map((item) => `${item.package}:${item.name}`));
const externallyReachable = new Set(["root:dev", "root:build", "root:typecheck", "root:lint", "root:test", "root:verify:fast", "root:verify:pr", "root:verify:main", "root:release:verify", "root:smoke:staging", "root:smoke:production"]);
const unreachable = executable.filter((item) => !externallyReachable.has(`${item.package}:${item.name}`) && consumersOf(item.name).length === 0).map((item) => `${item.package}:${item.name}`);
const repeatedWork = duplicateBodies.filter(({ command }) => /build|test|guard|architecture/i.test(command));
const report = { schemaVersion: 2, program: "PROD-READINESS-2026-08", generatedAt: new Date().toISOString(), counts: { rootScripts: Object.keys(rootPackage.scripts).length, apiScripts: Object.keys(apiPackage.scripts).length, apiGuards: Object.keys(apiPackage.scripts).filter((name) => name.startsWith("guard:")).length, workflows: workflows.length, executableScripts: executable.length }, scripts: all, callGraph, dependencies, duplicateBodies, recursion, unreachable, repeatedWork, workflows, notes: ["Consumers are exact textual pnpm run references; shell/node indirect invocation remains an explicit unknown.", "Unreachable means no exact textual consumer and no public front door; it is a review queue, not proof of dead code.", "Tier migration is explicit for public fronts; historical aliases are retained until their documented expiry."] };
writeFileSync(join(root, "docs/platform/PROD-3-INVENTORY.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.counts));
console.log(`prod3-inventory: ${report.workflows.length} workflows, ${report.duplicateBodies.length} duplicate command bodies`);
