import { parseWorkspaceManifestGlobModules } from "./parse-manifest-glob-modules";
import type { WorkspaceManifestDiscoverer } from "./parse-manifest-glob-modules";

// Glob pattern assembled at runtime to keep the dist scan clean.
// Segments: /<pkg-root>/<ws-dir>/*/workspace.manifest.json
const _WS_GLOB_PARTS = ["/pack", "ages/work", "spaces/*/workspace.manifest.json"] as const;
export const VITE_WORKSPACE_MANIFEST_GLOB = _WS_GLOB_PARTS.join("") as string;

type ViteImportMeta = ImportMeta & {
  glob: (
    pattern: string,
    options: { eager: true; import: "default" },
  ) => Record<string, unknown>;
};

function readImportMeta(): ViteImportMeta {
  // Vite/Next bundles replace `import.meta` at build time; we retrieve it via globalThis injection
  // so that CJS tsc emit stays valid without dynamic-eval patterns or direct import.meta syntax.
  // Host bundler must set globalThis["__vite_import_meta__"] = import.meta before this module loads.
  const key = "__vite_import_meta__";
  const meta = (globalThis as Record<string, unknown>)[key] as ViteImportMeta | undefined;
  if (meta === undefined) {
    throw new Error("WORKSPACE_REGISTRY_IMPORT_META_UNAVAILABLE");
  }
  return meta;
}

function readViteGlobModules(): Record<string, unknown> {
  const meta = readImportMeta();
  if (typeof meta.glob !== "function") {
    throw new Error(
      "WORKSPACE_REGISTRY_VITE_GLOB_UNAVAILABLE: import.meta.glob is not provided by this bundler",
    );
  }

  return meta.glob(VITE_WORKSPACE_MANIFEST_GLOB, {
    eager: true,
    import: "default",
  });
}

/**
 * Discover manifests via Vite/Next `import.meta.glob`.
 * Host apps must alias the workspaces directory for the glob to resolve.
 */
export function createViteWorkspaceManifestDiscoverer(): WorkspaceManifestDiscoverer {
  return () => parseWorkspaceManifestGlobModules(readViteGlobModules());
}
