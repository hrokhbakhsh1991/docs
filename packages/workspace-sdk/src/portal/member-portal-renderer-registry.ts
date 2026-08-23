import type {
  MemberPortalModuleRendererProps,
  WorkspaceMemberPortalRenderersCapability,
} from "../plugin/workspace-plugin-capabilities";

const renderersByPlugin = new Map<string, WorkspaceMemberPortalRenderersCapability["renderers"]>();

export function registerWorkspaceMemberPortalRenderers(
  pluginId: string,
  capability: WorkspaceMemberPortalRenderersCapability | undefined
): void {
  if (capability === undefined) {
    return;
  }
  renderersByPlugin.set(pluginId, capability.renderers);
}

export function getWorkspaceMemberPortalRenderer(
  pluginId: string,
  moduleId: string
): ((props: MemberPortalModuleRendererProps) => unknown) | undefined {
  return renderersByPlugin.get(pluginId)?.[moduleId];
}

export function clearWorkspaceMemberPortalRenderersForTests(): void {
  renderersByPlugin.clear();
}
