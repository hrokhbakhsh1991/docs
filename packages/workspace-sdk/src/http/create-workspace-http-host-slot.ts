/**
 * Tiny configure/get/reset slot for workspace HTTP host ports (DG-1.2).
 * Workspaces keep product-shaped `*HttpHostPorts` types; only the slot is shared.
 */
export type WorkspaceHttpHostSlot<TPorts> = {
  readonly configure: (ports: TPorts) => void;
  readonly resetForTests: () => void;
  readonly get: () => TPorts;
};

export function createWorkspaceHttpHostSlot<TPorts>(options: {
  readonly notConfiguredCode: string;
}): WorkspaceHttpHostSlot<TPorts> {
  let configuredPorts: TPorts | null = null;

  return {
    configure(ports: TPorts): void {
      configuredPorts = ports;
    },
    resetForTests(): void {
      configuredPorts = null;
    },
    get(): TPorts {
      if (configuredPorts === null) {
        throw new Error(options.notConfiguredCode);
      }
      return configuredPorts;
    },
  };
}
