import { BANNER } from "../constants.mjs";

export function generateWorkspaceOperatorCapabilities(manifests) {
  /** @type {Record<string, { usersDirectory: boolean; reconciliationTriage: boolean; fieldExposureSurfaces: boolean }>} */
  const capabilities = {};
  for (const manifest of manifests) {
    const operatorCapabilities = manifest.operatorCapabilities;
    if (operatorCapabilities === undefined) {
      continue;
    }
    capabilities[manifest.id] = Object.freeze({
      usersDirectory: operatorCapabilities.usersDirectory === true,
      reconciliationTriage: operatorCapabilities.reconciliationTriage === true,
      fieldExposureSurfaces: operatorCapabilities.fieldExposureSurfaces === true,
    });
  }

  const entries = Object.entries(capabilities)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([pluginId, value]) =>
        `  ${JSON.stringify(pluginId)}: Object.freeze({ usersDirectory: ${value.usersDirectory}, reconciliationTriage: ${value.reconciliationTriage}, fieldExposureSurfaces: ${value.fieldExposureSurfaces} }),`
    )
    .join("\n");

  return `${BANNER}
/** Operator API capabilities — derived from workspace.manifest.json operatorCapabilities. */
export const WORKSPACE_OPERATOR_CAPABILITIES: Readonly<
  Record<
    string,
    Readonly<{
      readonly usersDirectory: boolean;
      readonly reconciliationTriage: boolean;
      readonly fieldExposureSurfaces: boolean;
    }>
  >
> = Object.freeze({
${entries}
});
`;
}

/**
 * Wave D.c — validate optional operatorShell.phase3NavLinks / ownerSettingsPanel on a workspace manifest.
 * @param {{ id: string; operatorShell?: unknown }} manifest
 */
export function assertOperatorShellManifest(manifest) {
  if (manifest.operatorShell === undefined) {
    return;
  }
  const shell = manifest.operatorShell;
  if (typeof shell !== "object" || shell === null || Array.isArray(shell)) {
    throw new Error(`${manifest.id}: operatorShell must be an object`);
  }
  if ("phase3NavLinks" in shell && shell.phase3NavLinks !== undefined) {
    const links = /** @type {{ phase3NavLinks?: unknown }} */ (shell).phase3NavLinks;
    if (!Array.isArray(links)) {
      throw new Error(`${manifest.id}: operatorShell.phase3NavLinks must be an array`);
    }
    for (const [index, link] of links.entries()) {
      if (typeof link !== "object" || link === null || Array.isArray(link)) {
        throw new Error(`${manifest.id}: operatorShell.phase3NavLinks[${index}] must be an object`);
      }
      const row = /** @type {{ href?: unknown; labelKey?: unknown }} */ (link);
      if (typeof row.href !== "string" || !row.href.startsWith("/")) {
        throw new Error(
          `${manifest.id}: operatorShell.phase3NavLinks[${index}].href must be a root-relative path`
        );
      }
      if (typeof row.labelKey !== "string" || row.labelKey.trim().length === 0) {
        throw new Error(
          `${manifest.id}: operatorShell.phase3NavLinks[${index}].labelKey must be a non-empty string`
        );
      }
    }
  }
  if ("ownerSettingsPanel" in shell && shell.ownerSettingsPanel !== undefined) {
    const panel = /** @type {{ ownerSettingsPanel?: unknown }} */ (shell).ownerSettingsPanel;
    if (typeof panel !== "object" || panel === null || Array.isArray(panel)) {
      throw new Error(`${manifest.id}: operatorShell.ownerSettingsPanel must be an object`);
    }
    const row = /** @type {{ module?: unknown; exportName?: unknown }} */ (panel);
    if (typeof row.module !== "string" || !row.module.startsWith("@app-tour/")) {
      throw new Error(
        `${manifest.id}: operatorShell.ownerSettingsPanel.module must be an @app-tour/* package subpath`
      );
    }
    if (typeof row.exportName !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(row.exportName)) {
      throw new Error(
        `${manifest.id}: operatorShell.ownerSettingsPanel.exportName must be a valid JS identifier`
      );
    }
  }
}

/**
 * Wave D.c — Phase 3 AppShell nav links from operatorShell.phase3NavLinks.
 * @param {readonly { id: string; operatorShell?: { phase3NavLinks?: readonly { href: string; labelKey: string }[] } }}[]} manifests
 */
export function generateOperatorShellNavBindings(_manifests) {
  throw new Error(
    "Phase 4bc — operatorShellNav codegen removed; capabilities.operatorShellNav owns Phase 3 AppShell links"
  );
}

export function generateWorkspaceOwnerSettingsPanelLoaders(manifests) {
  for (const manifest of manifests) {
    assertOperatorShellManifest(manifest);
  }

  /** @type {string[]} */
  const cases = [];
  for (const manifest of [...manifests].sort((a, b) => a.id.localeCompare(b.id))) {
    const panel = manifest.operatorShell?.ownerSettingsPanel;
    if (panel == null) {
      continue;
    }
    cases.push(`    case ${JSON.stringify(manifest.id)}: {
      const mod = await import(${JSON.stringify(panel.module)});
      return mod.${panel.exportName};
    }`);
  }

  return `${BANNER}
import type { ReactNode } from "react";

/** Host props injected by apps/web workspace-owner settings page (Wave I.1). */
export type WorkspaceOwnerSettingsPanelHostProps = {
  readonly apiBaseUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly labels: {
    readonly title: string;
    readonly loadError: (status: number) => string;
    readonly catalogEnabled: string;
    readonly catalogSlug: string;
    readonly registrationPolicy: string;
    readonly yes: string;
    readonly no: string;
    readonly viewCatalog: string;
  };
};

/** Async RSC or sync panel accepted by the workspace-owner host page. */
export type WorkspaceOwnerSettingsPanelComponent = (
  props: WorkspaceOwnerSettingsPanelHostProps
) => ReactNode | Promise<ReactNode>;

/**
 * Lazy-load workspace-owner settings panel for a pluginId.
 * Returns null when the workspace does not declare operatorShell.ownerSettingsPanel.
 */
export async function loadWorkspaceOwnerSettingsPanel(
  pluginId: string
): Promise<WorkspaceOwnerSettingsPanelComponent | null> {
  switch (pluginId) {
${cases.join("\n")}
    default:
      return null;
  }
}
`;
}

/**
 * Wave F.b — frozen workspace commerce (PC-07) from manifest \`commerce.frozen\`.
 * @param {{ id: string; commerce?: unknown }} manifest
 */
export function assertWorkspaceCommerceManifest(manifest) {
  if (manifest.commerce === undefined) {
    return;
  }
  const commerce = manifest.commerce;
  if (typeof commerce !== "object" || commerce === null || Array.isArray(commerce)) {
    throw new Error(`${manifest.id}: commerce must be an object`);
  }
  if (commerce.frozen !== undefined && typeof commerce.frozen !== "boolean") {
    throw new Error(`${manifest.id}: commerce.frozen must be boolean`);
  }
  if (commerce.frozen !== true) {
    return;
  }
  if (commerce.paymentMode !== "offline_receipt" && commerce.paymentMode !== "gateway") {
    throw new Error(
      `${manifest.id}: commerce.frozen requires paymentMode offline_receipt|gateway`
    );
  }
  if (
    commerce.gatewayProvider !== null &&
    commerce.gatewayProvider !== "zibal" &&
    commerce.gatewayProvider !== "stripe"
  ) {
    throw new Error(
      `${manifest.id}: commerce.gatewayProvider must be null|zibal|stripe when frozen`
    );
  }
  if (typeof commerce.currency !== "string" || commerce.currency.trim().length === 0) {
    throw new Error(`${manifest.id}: commerce.frozen requires non-empty currency`);
  }
  if (commerce.paymentMode === "gateway" && commerce.gatewayProvider == null) {
    throw new Error(`${manifest.id}: commerce.frozen gateway mode requires gatewayProvider`);
  }
  if (commerce.paymentMode === "offline_receipt" && commerce.gatewayProvider != null) {
    throw new Error(
      `${manifest.id}: commerce.frozen offline_receipt requires gatewayProvider null`
    );
  }
}

/**
 * @param {readonly { id: string; workspaceTypes?: readonly string[]; commerce?: {
 *   frozen?: boolean;
 *   paymentMode?: string;
 *   gatewayProvider?: string | null;
 *   currency?: string;
 * } }}[]} manifests
 */
export function generateWorkspaceCommerceFreezeBindings(manifests) {
  for (const manifest of manifests) {
    assertWorkspaceCommerceManifest(manifest);
  }

  /** @type {Map<string, { paymentMode: string; gatewayProvider: string | null; currency: string }>} */
  const byType = new Map();
  for (const manifest of manifests) {
    if (manifest.commerce?.frozen !== true) {
      continue;
    }
    const types = Array.isArray(manifest.workspaceTypes) ? manifest.workspaceTypes : [manifest.id];
    const config = {
      paymentMode: manifest.commerce.paymentMode,
      gatewayProvider: manifest.commerce.gatewayProvider ?? null,
      currency: manifest.commerce.currency,
    };
    for (const workspaceType of types) {
      if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
        throw new Error(`${manifest.id}: workspaceTypes entries must be non-empty strings`);
      }
      const key = workspaceType.trim().toLowerCase();
      const existing = byType.get(key);
      if (existing !== undefined) {
        throw new Error(
          `${manifest.id}: duplicate frozen commerce for workspaceType ${JSON.stringify(key)}`
        );
      }
      byType.set(key, config);
    }
  }

  const entries = [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([workspaceType, config]) =>
        `  ${JSON.stringify(workspaceType)}: Object.freeze({ paymentMode: ${JSON.stringify(config.paymentMode)}, gatewayProvider: ${JSON.stringify(config.gatewayProvider)}, currency: ${JSON.stringify(config.currency)} }),`
    );

  return `${BANNER}
import type { WorkspaceCommerceConfig } from "./commerce-schema.js";

/** workspaceType → frozen commerce when manifest commerce.frozen (Wave F.b / PC-07). */
export const WORKSPACE_FROZEN_COMMERCE_BY_WORKSPACE_TYPE: Readonly<
  Record<string, WorkspaceCommerceConfig>
> = Object.freeze({
${entries.join("\n")}
});

export function resolveFrozenWorkspaceCommerce(
  workspaceType: string
): WorkspaceCommerceConfig | null {
  const key = workspaceType.trim().toLowerCase();
  if (key.length === 0) {
    return null;
  }
  return WORKSPACE_FROZEN_COMMERCE_BY_WORKSPACE_TYPE[key] ?? null;
}

export function isWorkspaceCommerceFrozen(workspaceType: string): boolean {
  return resolveFrozenWorkspaceCommerce(workspaceType) !== null;
}
`;
}
