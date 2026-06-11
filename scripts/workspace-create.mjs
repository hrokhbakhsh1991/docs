#!/usr/bin/env node
/**
 * P7-T01 — scaffold a new workspace package from starter template.
 * Usage: pnpm run workspace:create -- climbing-club
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function toPascalCase(id) {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toConstPrefix(id) {
  return id.replace(/-/g, "_").toUpperCase();
}

function usage() {
  console.error("Usage: pnpm run workspace:create -- <workspace-id>");
  console.error("Example: pnpm run workspace:create -- climbing-club");
  process.exit(1);
}

const id = process.argv[2]?.trim();
if (!id || id.startsWith("-")) usage();
if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error(`Invalid workspace id "${id}" — use kebab-case [a-z0-9-]`);
  process.exit(1);
}

const pkgName = `@app-tour/workspace-${id}`;
const dir = join(REPO_ROOT, "packages/workspaces", id);
if (existsSync(dir)) {
  console.error(`Already exists: ${dir}`);
  process.exit(1);
}

const pascal = toPascalCase(id);
const constPrefix = toConstPrefix(id);
const exportFn = `get${pascal}WorkspacePlugin`;
const pluginIdConst = `${constPrefix}_WORKSPACE_PLUGIN_ID`;
const typeConst = `${constPrefix}_WORKSPACE_TYPE`;

mkdirSync(join(dir, "src"), { recursive: true });
mkdirSync(join(dir, "test"), { recursive: true });
mkdirSync(join(dir, "theme"), { recursive: true });

writeFileSync(
  join(dir, "workspace.manifest.json"),
  `${JSON.stringify(
    {
      id,
      version: 1,
      package: pkgName,
      workspaceTypes: [id],
      plugin: { entry: `./${id}.plugin`, export: exportFn },
      web: { entry: `./${id}.plugin`, export: exportFn },
    },
    null,
    2
  )}\n`
);

writeFileSync(
  join(dir, "package.json"),
  `${JSON.stringify(
    {
      name: pkgName,
      version: "0.1.0",
      private: true,
      description: `${pascal} workspace plugin — scaffolded by workspace:create`,
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      exports: {
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
        [`./${id}.plugin`]: {
          types: `./dist/${id}.plugin.d.ts`,
          default: `./dist/${id}.plugin.js`,
        },
        "./theme/tokens.css": "./theme/tokens.css",
      },
      files: ["dist", "theme/tokens.css"],
      scripts: {
        build: "tsc -p tsconfig.json",
        lint: "tsc --noEmit",
        test: 'NODE_ENV=test node --import tsx --test "test/**/*.spec.ts"',
      },
      dependencies: {
        "@app-tour/design-tokens": "workspace:*",
        "@app-tour/platform-core": "workspace:*",
        "@app-tour/workspace-sdk": "workspace:*",
      },
      devDependencies: {
        "@app-tour/config": "workspace:*",
        "@types/node": "^24.0.0",
        tsx: "^4.20.6",
        typescript: "5.9.3",
      },
    },
    null,
    2
  )}\n`
);

writeFileSync(
  join(dir, "tsconfig.json"),
  `{
  "extends": "../../config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "test/**/*.spec.ts"]
}
`
);

writeFileSync(
  join(dir, "src", `${id}.plugin.ts`),
  `import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

export const ${pluginIdConst} = ${JSON.stringify(id)} as const;
export const ${typeConst} = ${JSON.stringify(id)} as const;

export function ${exportFn}(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return {
    ...base,
    id: ${pluginIdConst},
    supportedWorkspaceTypes: [${typeConst}],
  };
}
`
);

writeFileSync(
  join(dir, "src", "index.ts"),
  `export { ${exportFn}, ${pluginIdConst}, ${typeConst} } from "./${id}.plugin";
`
);

writeFileSync(
  join(dir, "test", "scaffold.spec.ts"),
  `import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import { ${exportFn}, ${pluginIdConst} } from "../src/${id}.plugin";

describe("${id} workspace scaffold", () => {
  it("exports a valid WorkspacePlugin", () => {
    const plugin = ${exportFn}();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, ${pluginIdConst});
  });
});
`
);

writeFileSync(
  join(dir, "theme", "tokens.css"),
  `/* ${pascal} workspace theme — extend --ws-* tokens */\n:root {\n  --ws-color-accent: #2563eb;\n}\n`
);

console.log(`workspace:create — scaffolded ${pkgName}`);
console.log(`  ${dir}`);
console.log("Next:");
console.log("  pnpm install");
console.log("  pnpm run generate:workspace-registry");
console.log(`  pnpm --filter ${pkgName} run build && pnpm --filter ${pkgName} run test`);
