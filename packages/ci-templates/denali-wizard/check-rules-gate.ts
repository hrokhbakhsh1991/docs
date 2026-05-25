import fs from "fs";

const RULE_MODEL_PATH = "apps/web/src/features/tours/wizard/denali/rules/denaliRuleModel.ts";
const RULE_REQUIRED_PATH = "apps/web/src/features/tours/wizard/denali/rules/denaliRuleRequired.ts";

function log(message: string) {
  console.log(`[Rules Gate] ${message}`);
  fs.appendFileSync("map.log", `[Rules Gate] ${message}\n`);
}

function extractCanonicalFieldPaths(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const paths = new Set<string>();

  const canonicalSetMatch = content.match(
    /export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set\(\[([\s\S]*?)\]\)/,
  );
  if (canonicalSetMatch) {
    canonicalSetMatch[1].split(",").forEach((p) => {
      const trimmed = p.trim().replace(/['"]/g, "");
      if (trimmed) paths.add(trimmed);
    });
  }

  const listFnMatch = content.match(
    /export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set\(listDenaliRuleFieldPaths\(\)\)/,
  );
  if (listFnMatch) {
    return extractRuleModelPaths(fs.readFileSync(RULE_MODEL_PATH, "utf-8"));
  }

  return Array.from(paths);
}

function extractRuleModelPaths(modelContent: string): string[] {
  const paths = new Set<string>();
  for (const match of modelContent.matchAll(/path: ["']([^"']+)["']/g)) {
    paths.add(match[1]);
  }
  return [...paths].sort();
}

function ruleModelDefinesPath(modelContent: string, path: string): boolean {
  return (
    modelContent.includes(`path: "${path}"`) ||
    modelContent.includes(`path: '${path}'`)
  );
}

function checkRules() {
  log("Starting Rules Gate check...");
  const modelContent = fs.readFileSync(RULE_MODEL_PATH, "utf-8");
  const ruleModelPaths = extractRuleModelPaths(modelContent);
  const canonicalPaths = new Set(extractCanonicalFieldPaths(RULE_REQUIRED_PATH));

  log(`Rule model defines ${ruleModelPaths.length} unique field paths.`);
  log(`DENALI_WIZARD_CANONICAL_FIELD_PATHS has ${canonicalPaths.size} entries.`);

  if (!modelContent.includes("export const denaliRuleSet: DenaliRuleSet")) {
    log("Error: Could not find denaliRuleSet in denaliRuleModel.ts");
    process.exit(1);
  }

  const missingFromAllowList = ruleModelPaths.filter((path) => !canonicalPaths.has(path));
  if (missingFromAllowList.length > 0) {
    log(
      `Error: Rule model paths missing from DENALI_WIZARD_CANONICAL_FIELD_PATHS: ${missingFromAllowList.join(", ")}`,
    );
    process.exit(1);
  }

  const uncoveredPaths: string[] = [];
  for (const path of canonicalPaths) {
    if (!ruleModelDefinesPath(modelContent, path)) {
      uncoveredPaths.push(path);
    }
  }

  if (uncoveredPaths.length > 0) {
    log(`Warning: Allow-list paths without rule field definition: ${uncoveredPaths.join(", ")}`);
  } else {
    log("All allow-list paths have a matching path definition in denaliRuleModel.");
  }

  const stepMatches = Array.from(modelContent.matchAll(/step: ["'](.*?)["']/g)).map((m) => m[1]);
  const uniqueSteps = Array.from(new Set(stepMatches));
  log(`Steps identified in rules: ${uniqueSteps.join(", ")}`);

  log("Rules Gate check completed.");
}

checkRules();
