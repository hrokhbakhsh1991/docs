export {
  WorkspaceManifestSchema,
  parseWorkspaceManifest,
  type WorkspaceManifestRecord,
  type WorkspaceRegistryEntry,
} from "./workspace-manifest.schema";

export {
  parseWorkspaceManifestGlobModules,
  workspaceRegistryEntriesFromManifests,
  type WorkspaceManifestDiscoverer,
} from "./parse-manifest-glob-modules";

export {
  createViteWorkspaceManifestDiscoverer,
} from "./vite-manifest-glob";

export {
  readWorkspaceManifestTheme,
  resolveWorkspaceManifestThemeForPlugin,
  type WorkspaceManifestTheme,
} from "./read-workspace-manifest-theme";

export {
  emitWorkspaceRegistryTelemetry,
  resetWorkspaceRegistryTelemetryForTests,
  setWorkspaceRegistryTelemetrySink,
  workspaceRegistryErrorToTelemetry,
  type WorkspaceRegistryFailureCode,
  type WorkspaceRegistryTelemetryEvent,
} from "./workspace-registry-telemetry";

export { WorkspaceRegistry } from "./workspace-registry";
export { workspaceRegistry } from "./singleton";
