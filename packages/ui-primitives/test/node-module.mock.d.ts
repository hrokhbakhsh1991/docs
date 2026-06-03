/**
 * Typings for patching Node's legacy CommonJS `Module._load` in test bootstrap.
 * Node does not publish stable public types for this hook.
 */
declare namespace NodeModuleLoaderMock {
  type LoadFn = (
    request: string,
    parent: import("node:module").Module | undefined,
    isMain: boolean,
  ) => unknown;

  interface ModuleConstructor {
    readonly _load: LoadFn;
    _resolveFilename(
      request: string,
      parent: import("node:module").Module | undefined,
      isMain: boolean,
      options?: import("node:module").ResolveOptions,
    ): string;
  }
}
