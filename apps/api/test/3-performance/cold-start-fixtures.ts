import {
  createStarterWorkspacePlugin,
  workspaceThemePresets,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

/** Starter field overrides reused per cell — exercises index build without override bloat. */
const STARTER_CELL_OVERRIDES = [
  { fieldId: "basics.title", required: true, hidden: false },
  { fieldId: "basics.featured", hidden: false },
  { fieldId: "details.summary", hidden: false },
  { fieldId: "details.status", hidden: false },
] as const;

/**
 * Builds a workspace plugin whose ruleSet approaches the platform index limit (256 cells).
 * Simulates a large tenant workspace bundle loaded at cold boot (serverless wake-up).
 */
export function buildLargeWorkspacePlugin(cellCount: number): WorkspacePlugin {
  const capped = Math.min(Math.max(cellCount, 1), 256);
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  const cells = Array.from({ length: capped }, (_, index) => ({
    cellId: `cell-${index}`,
    dimensions: { variant: index === 0 ? "default" : `v-${index}` },
    fieldOverrides: [...STARTER_CELL_OVERRIDES],
  }));
  return {
    ...base,
    ruleSet: {
      version: 1,
      matrixDimensions: ["variant"],
      defaultCellId: "cell-0",
      cells,
    },
  };
}

export const COLD_START_CANONICAL_INPUT = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: { title: "cold-start-probe" },
    details: { summary: "latency" },
  },
} as const;
