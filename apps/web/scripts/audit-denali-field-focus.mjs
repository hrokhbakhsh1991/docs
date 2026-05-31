import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const registrySrc = readFileSync(
  "@repo/denali-domain",
  "utf8",
);
const focusSrc = readFileSync(
  "src/features/tours/wizard/denali/denaliWizardFieldFocus.ts",
  "utf8",
);

const focusKeys = new Set([...focusSrc.matchAll(/"([^"]+)":\s*\[/g)].map((m) => m[1]));

const rows = [];
const blockRe =
  /canonicalPath:\s*"([^"]+)"[\s\S]*?stepId:\s*"([^"]+)"[\s\S]*?rhfPath:\s*"([^"]+)"/g;
let m;
while ((m = blockRe.exec(registrySrc))) {
  rows.push({ canonical: m[1], stepId: m[2], rhf: m[3] });
}

const uniqueByRhf = new Map();
for (const r of rows) {
  if (!uniqueByRhf.has(r.rhf)) uniqueByRhf.set(r.rhf, r);
}

function rgCount(pattern, glob = "src/features/tours/wizard/denali") {
  try {
    const n = execSync(`rg -F '${pattern.replace(/'/g, "'\\''")}' ${glob} -g '*.tsx' 2>/dev/null | wc -l`, {
      encoding: "utf8",
    }).trim();
    return Number(n) || 0;
  } catch {
    return 0;
  }
}

function domHookFor(rhf) {
  if (rgCount(`data-field-path="${rhf}"`)) return "data-field-path";
  const zone = rhf.match(/^basicInfo\.(startPoint|summitPoint|campPoint|endPoint|gatheringPoint)$/);
  if (zone && rgCount(`denali-location-zone-${zone[1]}`)) return `zone-testid:${zone[1]}`;
  if (rhf === "basicInfo.tourType" && rgCount("denali-basics-category")) return "testid:category";
  if (rhf === "programNature.themeIds" && rgCount("denali-theme-list")) return "testid:themes";
  if (rhf === "participantRequirements.gearItems" && rgCount("denali-gear-list")) return "testid:gear";
  if (rhf === "tripDetails.overview.customServiceLabels" && rgCount("denali-custom-services"))
    return "testid:custom-services";
  if (rhf.startsWith("policies.") && rgCount(`denali-pricing-${rhf.split(".")[1].replace(/Hours|Percentage|Text/g, "")}`))
    return "testid:policies-partial";
  return null;
}

const orphaned = [];
const focusGap = [];

for (const [rhf, meta] of uniqueByRhf) {
  const inFocus = focusKeys.has(rhf);
  const dom = domHookFor(rhf);
  if (!inFocus) {
    focusGap.push({ ...meta, dom: dom ?? "none" });
    if (!dom) orphaned.push({ ...meta });
  } else if (!dom) {
    focusGap.push({ ...meta, dom: "focus-map-only" });
  }
}

console.log(JSON.stringify({ registryUnique: uniqueByRhf.size, focusKeys: focusKeys.size, orphaned, focusGap }, null, 2));
