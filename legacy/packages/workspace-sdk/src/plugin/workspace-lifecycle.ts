export interface WorkspaceLifecycleTransition {
  readonly from: string;
  readonly to: string;
}

export interface WorkspaceLifecycleContract {
  readonly initialStatus: string;
  readonly publishStatus: string;
  readonly allowedTransitions: readonly WorkspaceLifecycleTransition[];
}
