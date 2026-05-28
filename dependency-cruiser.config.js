const fs = require("node:fs");
const path = require("node:path");

function listFeatureNames(appName) {
  const featuresDir = path.join(__dirname, "apps", appName, "src", "features");
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
/**
 * Semantic target: ^([^/]+/){4,}[^/]+$ — paths with 5+ `/`-delimited segments.
 * dependency-cruiser rejects nested quantifiers in `{4,}` (safe-regex); this expands
 * the same intent without nested repetition.
 */
const DEPTH_PATH_SEMANTIC = "^([^/]+/){4,}[^/]+$";

function noFolderDepthGt4FromPath() {
  const fourSegmentAnchor = "((?:[^/]+/[^/]+/[^/]+/[^/]+/))";
  const variants = [];
  for (let extraDirs = 1; extraDirs <= 12; extraDirs += 1) {
    const middle = Array(extraDirs).fill("[^/]+").join("/");
    variants.push(`^${fourSegmentAnchor}${middle}/[^/]+$`);
  }
  return variants.join("|");
}

function crossFeatureRules(appName) {
  const features = listFeatureNames(appName);
  return features.map((feature) => ({
    name: `no-cross-feature-internal-imports-${appName}-${feature}`,
    severity: "error",
    comment: `Feature "${feature}" in ${appName} must only import other features through their index.ts barrel.`,
    from: {
      path: `^apps/${appName}/src/features/${feature}/`,
    },
    to: {
      path: `^apps/${appName}/src/features/(?!${feature}/)`,
      pathNot: `^apps/${appName}/src/features/[^/]+/index\\.ts$`,
    },
  }));
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment:
        "Circular dependency chains are forbidden. Break the cycle or extract shared code to a neutral module.",
      from: {},
      to: {
        circular: true,
      },
    },
    ...crossFeatureRules("web"),
    ...crossFeatureRules("api"),
    {
      name: "no-folder-depth-gt-4",
      severity: "error",
      comment:
        `Deep paths (${DEPTH_PATH_SEMANTIC}) must not use relative imports that escape the first four-segment subtree ($1). Alias and package imports are allowed.`,
      from: {
        path: noFolderDepthGt4FromPath(),
        pathNot: "(\\.spec\\.|\\.test\\.|/__tests__/)",
      },
      to: {
        path: "^\\.",
        pathNot: "^$1",
      },
    },
    {
      name: "no-ui-direct-access",
      severity: "error",
      comment:
        "Only UI-layer files (components/steps/ui) are checked for direct backend/server access.",
      from: {
        path: "^apps/web/src/.*\\/(components|steps|ui)\\/",
        pathNot: "(\\.spec\\.|\\.test\\.)",
      },
      to: {
        path:
          "^(apps/api/|.*(/|^)(database|repositories?|entities?)(/|$)|.*\\.server\\.(ts|tsx|js|jsx)$|typeorm$|server-only$)",
      },
    },
    {
      name: "domain-boundary-integrity",
      severity: "error",
      comment:
        "Only the application layer (application/index.ts) is allowed to import from the domain façade.",
      from: {
        path: "^apps/web/src/.*/denali/",
        pathNot: "^apps/web/src/.*/denali/application/",
      },
      to: {
        path: "^apps/web/src/.*/domain/index\\.ts$",
      },
    },
    {
      name: "denali-internal-logic-isolation",
      severity: "error",
      comment:
        "UI-layer files must import Denali orchestration/hooks/rules only through the application façade.",
      from: {
        path: "^apps/web/src/.*/denali/(steps|components)/",
        pathNot: "(\\.spec\\.|\\.test\\.)",
      },
      to: {
        path: "^apps/web/src/.*/denali/(hooks|rules|DenaliCanonicalContext\\.tsx|denaliWizardCompletion\\.ts|denaliWizardDiagnostic\\.ts)",
      },
    },
    // Test-Pairing (co-located .spec/.test beside features/ and services/ sources) is enforced via:
    //   - ESLint `test-pairing/require-test-pair`
    //   - lint-staged `scripts/precommit-test-pairing-staged.mjs`
    //   - `pnpm guardrails:test-pairing` (full audit)
    // dependency-cruiser cannot express filesystem sibling pairing rules.
    {
      name: "no-test-to-internal-implementation-imports",
      severity: "error",
      comment:
        "Tests should target public API surface, not internal/private implementation files.",
      from: {
        path: "(\\.spec\\.|\\.test\\.|/test/|/__tests__/)",
      },
      to: {
        path: "(/internal/|/private/|/__private__/)",
      },
    },
  ],
  options: {
    exclude:
      "(^|/)(node_modules|dist|coverage|.next|.turbo|build|out|tmp|typedoc-out|storybook-static|\\.storybook)(/|$)|\\.(d\\.ts|map|stories\\.tsx?|stories\\.mdx)$",
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
    },
  },
};
