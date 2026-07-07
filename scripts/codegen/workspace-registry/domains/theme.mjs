import { BANNER } from "../constants.mjs";

export function generateWorkspaceThemeStylesheets(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  for (const m of manifests) {
    const sheets = Array.isArray(m.themeStylesheets) ? m.themeStylesheets : [];
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(`${m.id}: themeStylesheets entries must be non-empty strings`);
      }
      importLines.add(`import "${m.package}/${sheet}";`);
    }
  }
  return `${BANNER}
${[...importLines].sort().join("\n")}
`;
}


/**
 * Per-plugin dynamic admin CSS loader — no eager import of all workspace admin skins.
 * @param {import("./generate-workspace-registry.mjs").WorkspaceManifest[]} manifests
 */
export function generateAdminThemeStylesheetLoader(manifests) {
  /** @type {{ id: string; package: string; sheets: string[] }[]} */
  const entries = [];
  for (const m of manifests) {
    const sheets = Array.isArray(m.themeStylesheets) ? m.themeStylesheets : [];
    if (sheets.length === 0) {
      continue;
    }
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(`${m.id}: themeStylesheets entries must be non-empty strings`);
      }
    }
    entries.push({ id: m.id, package: m.package, sheets: [...sheets] });
  }
  entries.sort((left, right) => left.id.localeCompare(right.id));

  const registryLines = entries
    .map(
      (entry) =>
        `  ${JSON.stringify(entry.id)}: Object.freeze([${entry.sheets.map((s) => JSON.stringify(s)).join(", ")}]),`
    )
    .join("\n");

  const switchCases = entries
    .map((entry) => {
      const imports = entry.sheets
        .map((sheet) => `      await import("${entry.package}/${sheet}");`)
        .join("\n");
      return `    case ${JSON.stringify(entry.id)}:\n${imports}\n      return;`;
    })
    .join("\n\n");

  return `${BANNER}
/** Manifest paths per workspace plugin (documentation / guards). */
export const WORKSPACE_ADMIN_THEME_REGISTRY = Object.freeze({
${registryLines}
}) as Readonly<Record<string, readonly string[]>>;

/** Load workspace admin skin CSS for the active plugin only (dynamic import). */
export async function importAdminThemeForPlugin(pluginId: string): Promise<void> {
  switch (pluginId) {
${switchCases}
    default:
      return;
  }
}
`;
}

export function generateGuestThemeStylesheets(manifests, surface) {
  if (typeof surface !== "string" || surface.trim().length === 0) {
    throw new Error("generateGuestThemeStylesheets: surface is required");
  }
  /** @type {Set<string>} */
  const importLines = new Set();
  for (const m of manifests) {
    const guest = m.guestThemeStylesheets;
    if (guest === undefined || guest === null) {
      continue;
    }
    if (typeof guest !== "object" || Array.isArray(guest)) {
      throw new Error(`${m.id}: guestThemeStylesheets must be an object keyed by app surface`);
    }
    const sheets = guest[surface];
    if (sheets === undefined) {
      continue;
    }
    if (!Array.isArray(sheets)) {
      throw new Error(`${m.id}: guestThemeStylesheets.${surface} must be an array`);
    }
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(
          `${m.id}: guestThemeStylesheets.${surface} entries must be non-empty strings`
        );
      }
      importLines.add(`import "${m.package}/${sheet}";`);
    }
  }
  return `${BANNER}
${[...importLines].sort().join("\n")}
`;
}

/**
 * Per-plugin dynamic CSS loader (marketing MKT-7 — no eager import of all workspace skins).
 * @param {import("./generate-workspace-registry.mjs").WorkspaceManifest[]} manifests
 * @param {string} surface
 */
export function generateGuestThemeStylesheetLoader(manifests, surface) {
  if (typeof surface !== "string" || surface.trim().length === 0) {
    throw new Error("generateGuestThemeStylesheetLoader: surface is required");
  }

  const surfaceCamel =
    surface === "marketing"
      ? "Marketing"
      : surface.charAt(0).toUpperCase() + surface.slice(1);

  /** @type {{ id: string; package: string; sheets: string[] }[]} */
  const entries = [];

  for (const m of manifests) {
    const guest = m.guestThemeStylesheets;
    if (guest === undefined || guest === null) {
      continue;
    }
    if (typeof guest !== "object" || Array.isArray(guest)) {
      throw new Error(`${m.id}: guestThemeStylesheets must be an object keyed by app surface`);
    }
    const sheets = guest[surface];
    if (sheets === undefined) {
      continue;
    }
    if (!Array.isArray(sheets) || sheets.length === 0) {
      throw new Error(`${m.id}: guestThemeStylesheets.${surface} must be a non-empty array`);
    }
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(
          `${m.id}: guestThemeStylesheets.${surface} entries must be non-empty strings`
        );
      }
    }
    entries.push({ id: m.id, package: m.package, sheets: [...sheets] });
  }

  entries.sort((left, right) => left.id.localeCompare(right.id));

  const registryLines = entries
    .map(
      (entry) =>
        `  ${JSON.stringify(entry.id)}: Object.freeze([${entry.sheets.map((s) => JSON.stringify(s)).join(", ")}]),`
    )
    .join("\n");

  const switchCases = entries
    .map((entry) => {
      const imports = entry.sheets
        .map((sheet) => `      await import("${entry.package}/${sheet}");`)
        .join("\n");
      return `    case ${JSON.stringify(entry.id)}:\n${imports}\n      return;`;
    })
    .join("\n\n");

  return `${BANNER}${surface === "portal" ? `
/** Starter workspace owns the default portal L3 skin (Phase D.2). */
export const WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN =
  "@app-tour/workspace-starter/theme/starter-portal.css" as const;
` : ""}${surface === "marketing" ? `
/** Starter workspace owns the default marketing L3 skin (Phase D.3). */
export const WORKSPACE_GUEST_MARKETING_DEFAULT_SKIN =
  "@app-tour/workspace-starter/theme/starter-marketing.css" as const;
` : ""}
/** Manifest paths per workspace plugin (documentation / guards). */
export const WORKSPACE_GUEST_${surface.toUpperCase()}_THEME_REGISTRY = Object.freeze({
${registryLines}
}) as Readonly<Record<string, readonly string[]>>;

/** Load workspace skin CSS for the active plugin only (dynamic import). */
export async function importGuest${surfaceCamel}ThemeForPlugin(pluginId: string): Promise<void> {
${surface === "portal" ? '  await import("@app-tour/workspace-starter/theme/starter-portal.css");\n' : ""}${surface === "marketing" ? '  await import("@app-tour/workspace-starter/theme/starter-marketing.css");\n' : ""}  switch (pluginId) {
${switchCases}
    default:
      return;
  }
}
`;
}
