/**
 * Reusable ts-morph codemod template: inject RegistrationsTourCatalogPort stub
 * as the 11th constructor arg on TypeOrmRegistrationsApplicationService in tests.
 *
 * Run from repo root:
 *   node --import tsx scripts/codemods/fix_with_ts_morph.ts
 */
import { Project, SyntaxKind } from "ts-morph";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const project = new Project();
project.addSourceFilesAtPaths(path.join(repoRoot, "apps/api/test/**/*.ts"));

const stubStr = `{
    getTourSnapshot: async () => ({ id: "11111111-1111-4111-8111-111111111111", tenantId: "11111111-1111-4111-8111-111111111111", lifecycleStatus: "OPEN", acceptedCount: 0, totalCapacity: 10, autoAcceptRegistrations: true, costContext: {}, details: { tripDetails: {} }, tourDepartureId: null, transportModes: ["bus"] }),
    lockTourSnapshot: async () => ({ id: "11111111-1111-4111-8111-111111111111", tenantId: "11111111-1111-4111-8111-111111111111", lifecycleStatus: "OPEN", acceptedCount: 0, totalCapacity: 10, autoAcceptRegistrations: true, costContext: {}, details: { tripDetails: {} }, tourDepartureId: null, transportModes: ["bus"] }),
    getTourTitles: async () => new Map(),
    applyAcceptedCounterDelta: async () => {},
    syncTourDepartureCapacity: async () => {}
  } as never`;

let changed = false;

for (const sourceFile of project.getSourceFiles()) {
  const newExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression);
  for (const expr of newExpressions) {
    if (expr.getExpression().getText() === "TypeOrmRegistrationsApplicationService") {
      const args = expr.getArguments();
      if (args.length < 11) {
        while (expr.getArguments().length < 10) {
          expr.addArgument("{} as never");
        }

        if (expr.getArguments().length === 10) {
          expr.addArgument(stubStr);
          changed = true;
          console.log(`Updated ${sourceFile.getFilePath()}`);
        }
      } else if (args.length === 11) {
        const lastArg = args[10];
        if (!lastArg.getText().includes("getTourSnapshot")) {
          expr.removeArgument(10);
          expr.addArgument(stubStr);
          changed = true;
          console.log(`Replaced 11th arg in ${sourceFile.getFilePath()}`);
        }
      }
    }
  }
}

if (changed) {
  project.saveSync();
  console.log("Saved all files.");
} else {
  console.log("No changes needed.");
}
