import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 * @param {ReturnType<typeof discoverManifests>} allManifests
 */
export function assertCatalogRegistrationFlowManifest(manifest, allManifests) {
  const cfg = manifest.catalogRegistrationFlow;
  if (cfg === undefined) {
    return;
  }
  if (typeof cfg.surfaceExport !== "string" || cfg.surfaceExport.length === 0) {
    throw new Error(`${manifest.id}: catalogRegistrationFlow.surfaceExport is required`);
  }
  const steps = cfg.steps;
  if (steps === undefined || typeof steps !== "object") {
    throw new Error(`${manifest.id}: catalogRegistrationFlow.steps is required`);
  }
  if (steps.mode === "bundle") {
    if (typeof steps.export !== "string" || steps.export.length === 0) {
      throw new Error(`${manifest.id}: catalogRegistrationFlow.steps.export is required for bundle mode`);
    }
    return;
  }
  if (steps.mode === "compose") {
    const authSource = steps.reuseAuthStepsFrom ?? steps.reuseFrom;
    if (typeof authSource !== "string" || authSource.length === 0) {
      throw new Error(
        `${manifest.id}: catalogRegistrationFlow.steps.reuseAuthStepsFrom or reuseFrom is required for compose mode`
      );
    }
    if (authSource !== "shared") {
      const source = allManifests.find((m) => m.id === authSource);
      if (source === undefined) {
        throw new Error(
          `${manifest.id}: catalogRegistrationFlow.steps reuse source unknown workspace "${authSource}"`
        );
      }
      if (source.catalogRegistrationFlow === undefined) {
        throw new Error(
          `${manifest.id}: catalogRegistrationFlow reuse source "${authSource}" has no catalogRegistrationFlow block`
        );
      }
    }
    const components = steps.components;
    if (components === undefined || typeof components !== "object") {
      throw new Error(`${manifest.id}: catalogRegistrationFlow.steps.components is required for compose mode`);
    }
    for (const key of ["intake", "done"]) {
      if (typeof components[key] !== "string" || components[key].length === 0) {
        throw new Error(`${manifest.id}: catalogRegistrationFlow.steps.components.${key} is required`);
      }
    }
    return;
  }
  throw new Error(`${manifest.id}: catalogRegistrationFlow.steps.mode must be "bundle" or "compose"`);
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceRegistrationFlowPlugins(manifests) {
  for (const manifest of manifests) {
    assertCatalogRegistrationFlowManifest(manifest, manifests);
  }

  const configured = manifests.filter((m) => m.catalogRegistrationFlow !== undefined);
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const registerBlocks = [];

  for (const manifest of configured) {
    const cfg = manifest.catalogRegistrationFlow;
    const surfaceSpec = `${manifest.package}/catalog-registration-flow`;
    importLines.add(
      `import { ${cfg.surfaceExport} } from "${surfaceSpec}";`
    );

    if (cfg.steps.mode === "bundle") {
      const stepsSpec = `${manifest.package}/catalog-registration-flow/react`;
      importLines.add(`import { ${cfg.steps.export} } from "${stepsSpec}";`);
      registerBlocks.push(`  registerWorkspaceRegistrationFlowPlugin({
    id: ${JSON.stringify(manifest.id)},
    catalogRegistrationFlow: ${cfg.surfaceExport},
  });
  registerWorkspaceRegistrationFlowSteps(${JSON.stringify(manifest.id)}, ${cfg.steps.export});`);
      continue;
    }

    const authSource = cfg.steps.reuseAuthStepsFrom ?? cfg.steps.reuseFrom;
    const localSpec = `${manifest.package}/catalog-registration-flow/react`;
    importLines.add(
      `import { ${cfg.steps.components.intake}, ${cfg.steps.components.done} } from "${localSpec}";`
    );

    if (authSource === "shared") {
      importLines.add(
        `import { CatalogRegistrationOtpStep, CatalogRegistrationPhoneStep, CatalogRegistrationProfileStep } from "@app-tour/catalog-registration-flow-ui/react";`
      );
      registerBlocks.push(`  registerWorkspaceRegistrationFlowPlugin({
    id: ${JSON.stringify(manifest.id)},
    catalogRegistrationFlow: ${cfg.surfaceExport},
  });
  registerWorkspaceRegistrationFlowSteps(${JSON.stringify(manifest.id)}, {
    phone: CatalogRegistrationPhoneStep,
    otp: CatalogRegistrationOtpStep,
    profile: CatalogRegistrationProfileStep,
    intake: ${cfg.steps.components.intake},
    done: ${cfg.steps.components.done},
  });`);
      continue;
    }

    const source = manifests.find((m) => m.id === authSource);
    if (source === undefined) {
      throw new Error(`${manifest.id}: internal error resolving auth step reuse source`);
    }
    const reuseSpec = `${source.package}/catalog-registration-flow/react`;
    importLines.add(
      `import { DenaliOtpStep, DenaliPhoneStep, DenaliProfileStep } from "${reuseSpec}";`
    );
    registerBlocks.push(`  registerWorkspaceRegistrationFlowPlugin({
    id: ${JSON.stringify(manifest.id)},
    catalogRegistrationFlow: ${cfg.surfaceExport},
  });
  registerWorkspaceRegistrationFlowSteps(${JSON.stringify(manifest.id)}, {
    phone: DenaliPhoneStep,
    otp: DenaliOtpStep,
    profile: DenaliProfileStep,
    intake: ${cfg.steps.components.intake},
    done: ${cfg.steps.components.done},
  });`);
  }

  return `${BANNER}
import { registerWorkspaceRegistrationFlowPlugin } from "@app-tour/workspace-sdk";
${[...importLines].sort().join("\n")}

import { registerWorkspaceRegistrationFlowSteps } from "./registration-flow";

export function registerWorkspaceRegistrationFlowPluginsFromManifest(): void {
${registerBlocks.join("\n\n")}
}
`;
}

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
export function assertCatalogRegistrationTransportInitializerManifest(manifest) {
  const cfg = manifest.catalogRegistrationFlow;
  if (cfg === undefined || cfg.transportInitializerExport === undefined) {
    return;
  }
  if (typeof cfg.transportInitializerExport !== "string" || cfg.transportInitializerExport.length === 0) {
    throw new Error(
      `${manifest.id}: catalogRegistrationFlow.transportInitializerExport must be a non-empty string`
    );
  }
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceRegistrationTransportInitializers(manifests) {
  for (const manifest of manifests) {
    assertCatalogRegistrationTransportInitializerManifest(manifest);
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const callLines = [];

  for (const manifest of manifests) {
    const exportName = manifest.catalogRegistrationFlow?.transportInitializerExport;
    if (exportName === undefined) {
      continue;
    }
    const spec = `${manifest.package}/catalog-registration-flow`;
    importLines.add(`import { ${exportName} } from "${spec}";`);
    callLines.push(`  ${exportName}();`);
  }

  const body =
    callLines.length > 0
      ? callLines.join("\n")
      : "  // no workspace declares catalogRegistrationFlow.transportInitializerExport";

  return `${BANNER}
${[...importLines].sort().join("\n")}

export function registerWorkspaceRegistrationTransportInitializersFromManifest(): void {
${body}
}
`;
}

export function generateWorkspaceIntakePluginBootstrap(manifests) {
  const importLines = manifests.map((m) => {
    const spec = importSpecifier(m.package, m.plugin.entry);
    return `import { ${m.plugin.export} } from "${spec}";`;
  });

  const pluginCalls = manifests.map((m) => `    ${m.plugin.export}(),`).join("\n");

  return `${BANNER}
import { registerWorkspaceIntakePlugin } from "@app-tour/workspace-sdk";
${importLines.join("\n")}

export function registerWorkspaceIntakePluginsFromManifest(): void {
  for (const plugin of [
${pluginCalls}
  ]) {
    if (plugin.catalogIntake === undefined) {
      continue;
    }
    registerWorkspaceIntakePlugin({
      id: plugin.id,
      catalogIntake: plugin.catalogIntake,
    });
  }
}
`;
}
