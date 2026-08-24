import type { WorkspaceManifestDiscoverer } from "./parse-manifest-glob-modules";
import type { WorkspaceRegistryEntry } from "./workspace-manifest.schema";
import { reportWorkspaceRegistryFailure } from "./workspace-registry-telemetry";
import { createViteWorkspaceManifestDiscoverer } from "./vite-manifest-glob";

export class WorkspaceRegistry {
  private loaded = false;
  private manifestFingerprint: string | null = null;
  private readonly byId = new Map<string, WorkspaceRegistryEntry>();
  private readonly ordered: WorkspaceRegistryEntry[] = [];

  /**
   * Discover and index workspace manifests.
   * Pass a custom discoverer in Node/tests; default uses Vite `import.meta.glob`.
   */
  async load(discoverer?: WorkspaceManifestDiscoverer): Promise<this> {
    const resolveDiscoverer = discoverer ?? createViteWorkspaceManifestDiscoverer();
    try {
      const entries = await resolveDiscoverer();
      this.install(entries);
      this.loaded = true;
      return this;
    } catch (error) {
      reportWorkspaceRegistryFailure(error, "WorkspaceRegistry.load");
      throw error;
    }
  }

  get(workspaceId: string): WorkspaceRegistryEntry | undefined {
    return this.byId.get(workspaceId);
  }

  getOrThrow(workspaceId: string): WorkspaceRegistryEntry {
    const entry = this.get(workspaceId);
    if (entry === undefined) {
      throw new Error(`WORKSPACE_REGISTRY_UNKNOWN:${workspaceId}`);
    }
    return entry;
  }

  list(): readonly WorkspaceRegistryEntry[] {
    return this.ordered;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getManifestFingerprint(): string | null {
    return this.manifestFingerprint;
  }

  setManifestFingerprint(fingerprint: string): void {
    this.manifestFingerprint = fingerprint;
  }

  /** Clear registry so a subsequent load picks up on-disk manifest changes. */
  reloadForManifestChange(): void {
    this.loaded = false;
    this.manifestFingerprint = null;
    this.byId.clear();
    this.ordered.length = 0;
  }

  /** @internal test-only reset */
  resetForTests(): void {
    if (process.env.NODE_ENV !== "test") {
      return;
    }
    this.loaded = false;
    this.byId.clear();
    this.ordered.length = 0;
  }

  private install(entries: readonly WorkspaceRegistryEntry[]): void {
    const seenIds = new Set<string>();
    for (const entry of entries) {
      if (seenIds.has(entry.workspaceId)) {
        throw new Error(`WORKSPACE_REGISTRY_DUPLICATE_ID:${entry.workspaceId}`);
      }
      seenIds.add(entry.workspaceId);
    }

    this.byId.clear();
    this.ordered.length = 0;

    for (const entry of entries) {
      this.byId.set(entry.workspaceId, entry);
      this.ordered.push(entry);
    }

    this.ordered.sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
  }
}
