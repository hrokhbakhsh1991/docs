/**
 * Plain-tree ingress — prototype hardening, sanitize/clone policies, storage presets.
 */
import {
  IngressSanitizationError,
  ingressCodeFromShieldMessage,
  type IngressSanitizationErrorCode,
} from "../errors/ingress-sanitization-error";
import { sdkErr, sdkOk, type SdkResult } from "../errors/sdk-result";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export type PlainObjectShieldFail = (message: string) => never;

export type PlainTreePolicy = {
  readonly allowArrays: boolean;
  readonly allowFunctions: boolean;
  readonly maxDepth: number;
  readonly maxKeysPerObject?: number;
  readonly clone: boolean;
  readonly onLeaf?: (value: unknown, path: string, depth: number) => void;
};

export type IngressSanitizeOptions = {
  readonly allowArrays: boolean;
  readonly allowFunctions: boolean;
  readonly maxDepth: number;
};

export type PlainObjectShieldOptions = {
  readonly maxDepth: number;
  readonly maxKeysPerObject: number;
  readonly onLeaf: (value: unknown, path: string, depth: number) => void;
};

const DEFAULT_STORAGE_POLICY: PlainTreePolicy = {
  allowArrays: false,
  allowFunctions: false,
  maxDepth: 32,
  clone: true,
};

export const policyPluginStorage = (
  overrides: Partial<IngressSanitizeOptions> = {},
): PlainTreePolicy => ({
  ...DEFAULT_STORAGE_POLICY,
  allowArrays: overrides.allowArrays ?? DEFAULT_STORAGE_POLICY.allowArrays,
  allowFunctions: overrides.allowFunctions ?? DEFAULT_STORAGE_POLICY.allowFunctions,
  maxDepth: overrides.maxDepth ?? DEFAULT_STORAGE_POLICY.maxDepth,
});

export const policyCanonicalDocument = (
  overrides: Partial<Pick<PlainTreePolicy, "maxDepth" | "maxKeysPerObject">> = {},
): PlainTreePolicy => ({
  allowArrays: true,
  allowFunctions: false,
  maxDepth: overrides.maxDepth ?? 32,
  maxKeysPerObject: overrides.maxKeysPerObject,
  clone: true,
});

function failWithMessage(
  fail: PlainObjectShieldFail,
  _path: string,
  _reason: string,
  message: string,
): never {
  fail(message);
}

function ingressPathFromMessage(message: string, fallback: string): string {
  const at = message.lastIndexOf(" at ");
  return at >= 0 ? message.slice(at + 4) : fallback;
}

function ingressFail(path: string, message: string): never {
  throw new IngressSanitizationError(ingressCodeFromShieldMessage(message), message, path);
}

function ingressFailFromMessage(rootLabel: string, message: string): never {
  ingressFail(ingressPathFromMessage(message, rootLabel), message);
}

function ingressFailCode(
  path: string,
  code: IngressSanitizationErrorCode,
  message: string,
): never {
  throw new IngressSanitizationError(code, message, path);
}

function shieldFailAt(path: string): PlainObjectShieldFail {
  return (message: string) => {
    ingressFail(path, message);
  };
}

function rejectExoticLeafIngress(value: unknown, path: string): void {
  if (typeof value === "bigint") {
    ingressFailCode(path, "BIGINT_NOT_ALLOWED", `BigInt is not allowed at ${path}`);
  }
  if (typeof value === "symbol") {
    ingressFailCode(path, "SYMBOL_NOT_ALLOWED", `Symbol is not allowed at ${path}`);
  }
}

function rejectExoticLeafShield(
  value: unknown,
  path: string,
  fail: PlainObjectShieldFail,
): void {
  if (typeof value === "bigint") {
    failWithMessage(fail, path, "BigInt", `BigInt is not allowed at ${path}`);
  }
  if (typeof value === "symbol") {
    failWithMessage(fail, path, "Symbol primitive", `Symbol is not allowed at ${path}`);
  }
  if (typeof value === "function") {
    failWithMessage(fail, path, "Function primitive", `Function is not allowed at ${path}`);
  }
}

export function readOwnDataProperty(
  object: object,
  key: string,
  path: string,
  fail: PlainObjectShieldFail,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor == null) {
    failWithMessage(
      fail,
      path,
      `missing descriptor for "${key}"`,
      `Missing property descriptor for "${key}" at ${path}`,
    );
  }
  if (descriptor.get != null || descriptor.set != null) {
    failWithMessage(
      fail,
      path,
      `accessor property "${key}"`,
      `Accessor property "${key}" is not allowed at ${path}`,
    );
  }
  if (!("value" in descriptor)) {
    failWithMessage(
      fail,
      path,
      `non-data descriptor on "${key}"`,
      `Non-data property descriptor "${key}" is not allowed at ${path}`,
    );
  }
  return descriptor.value;
}

/**
 * Non-throwing prototype chain inspection (OF-02).
 */
export function inspectPlainPrototype(
  value: object,
  path: string,
): SdkResult<null, IngressSanitizationErrorCode> {
  let proto: object | null;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    return sdkErr(
      "PROTOTYPE_INTROSPECTION_TRAP",
      `Prototype introspection failed at ${path} (possible Proxy trap)`,
      path,
    );
  }

  let protoAgain: object | null;
  try {
    protoAgain = Object.getPrototypeOf(value);
  } catch {
    return sdkErr(
      "PROTOTYPE_INTROSPECTION_TRAP",
      `Prototype introspection failed at ${path} (possible Proxy trap)`,
      path,
    );
  }

  if (proto !== protoAgain) {
    return sdkErr(
      "UNSTABLE_PROTOTYPE",
      `Unstable prototype at ${path} (proxy or polluted getter)`,
      path,
    );
  }

  if (proto !== Object.prototype) {
    return sdkErr("NON_PLAIN_PROTOTYPE", `Non-plain object at ${path}`, path);
  }

  return sdkOk(null);
}

export function assertStablePlainPrototype(
  value: object,
  path: string,
  fail: PlainObjectShieldFail,
): void {
  const inspected = inspectPlainPrototype(value, path);
  if (!inspected.ok) {
    failWithMessage(fail, path, inspected.error.code, inspected.error.message);
  }
}

export function rejectExoticLeaf(
  value: unknown,
  path: string,
  fail: PlainObjectShieldFail,
): void {
  rejectExoticLeafShield(value, path, fail);
}

export function rejectArrayLikePlainObject(
  value: object,
  path: string,
  fail: PlainObjectShieldFail,
): void {
  if (!Object.prototype.hasOwnProperty.call(value, "length")) {
    return;
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor != null &&
    "value" in lengthDescriptor &&
    typeof lengthDescriptor.value === "number"
  ) {
    failWithMessage(
      fail,
      path,
      "array-like object",
      `Array-like plain object (length=${lengthDescriptor.value}) is not allowed at ${path}`,
    );
  }
}

function ingressRejectArrayLike(value: object, path: string): void {
  rejectArrayLikePlainObject(value, path, shieldFailAt(path));
}

function walkPlainTree(
  value: unknown,
  path: string,
  depth: number,
  policy: PlainTreePolicy,
  fail: PlainObjectShieldFail,
  useIngressCodes: boolean,
): unknown {
  if (depth > policy.maxDepth) {
    if (useIngressCodes) {
      ingressFailCode(path, "MAX_DEPTH_EXCEEDED", `Max depth exceeded at ${path}`);
    }
    fail(`Max depth exceeded at ${path}`);
  }

  if (value == null) {
    policy.onLeaf?.(value, path, depth);
    return value;
  }

  if (Array.isArray(value)) {
    if (!policy.allowArrays) {
      if (useIngressCodes) {
        ingressFailCode(path, "ARRAY_NOT_ALLOWED", `Arrays are not allowed at ${path}`);
      }
      failWithMessage(fail, path, "array node", `Arrays are not allowed at ${path}`);
    }
    if (!policy.clone) {
      failWithMessage(fail, path, "array node", `Arrays are not allowed at ${path}`);
    }
    const items = value.map((item, index) =>
      walkPlainTree(item, `${path}[${index}]`, depth + 1, policy, fail, useIngressCodes),
    );
    return Object.freeze(items);
  }

  if (typeof value === "function") {
    if (policy.allowFunctions) {
      return value;
    }
    if (useIngressCodes) {
      ingressFailCode(path, "FUNCTION_NOT_ALLOWED", `Function is not allowed at ${path}`);
    }
    failWithMessage(fail, path, "Function primitive", `Function is not allowed at ${path}`);
  }

  if (useIngressCodes) {
    rejectExoticLeafIngress(value, path);
  } else {
    rejectExoticLeafShield(value, path, fail);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    policy.onLeaf?.(value, path, depth);
    return value;
  }

  if (typeof value !== "object") {
    if (useIngressCodes) {
      ingressFailCode(path, "UNSUPPORTED_PRIMITIVE", `Unsupported value at ${path}`);
    }
    failWithMessage(fail, path, "unsupported primitive", `Unsupported value at ${path}`);
  }

  assertStablePlainPrototype(value, path, fail);
  if (useIngressCodes) {
    ingressRejectArrayLike(value, path);
  } else {
    rejectArrayLikePlainObject(value, path, fail);
  }

  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    if (useIngressCodes) {
      ingressFailCode(path, "SYMBOL_KEYS", `Symbol keys are not allowed at ${path}`);
    }
    failWithMessage(fail, path, "symbol keys", `Symbol keys are not allowed at ${path}`);
  }

  const enumerableKeys = Object.keys(value);
  const ownNames = Object.getOwnPropertyNames(value);
  if (ownNames.length !== enumerableKeys.length) {
    const msg = `Hidden non-enumerable keys are not allowed at ${path}`;
    if (useIngressCodes) {
      ingressFailCode(path, "HIDDEN_NON_ENUMERABLE_KEYS", msg);
    }
    failWithMessage(fail, path, "hidden non-enumerable keys", msg);
  }
  for (const key of ownNames) {
    if (!enumerableKeys.includes(key)) {
      const msg = `Hidden non-enumerable key "${key}" is not allowed at ${path}`;
      if (useIngressCodes) {
        ingressFailCode(path, "HIDDEN_NON_ENUMERABLE_KEYS", msg);
      }
      failWithMessage(fail, path, "hidden non-enumerable keys", msg);
    }
  }

  if (policy.maxKeysPerObject != null && enumerableKeys.length > policy.maxKeysPerObject) {
    fail(`Too many keys at ${path}`);
  }

  if (!policy.clone) {
    for (const key of enumerableKeys) {
      if (FORBIDDEN_KEYS.has(key)) {
        failWithMessage(fail, path, `forbidden key "${key}"`, `Forbidden key "${key}" at ${path}`);
      }
      const child = readOwnDataProperty(value, key, `${path}.${key}`, fail);
      walkPlainTree(child, `${path}.${key}`, depth + 1, policy, fail, useIngressCodes);
    }
    return value;
  }

  const clone = Object.create(Object.prototype) as Record<string, unknown>;
  for (const key of enumerableKeys) {
    if (FORBIDDEN_KEYS.has(key)) {
      failWithMessage(fail, path, `forbidden key "${key}"`, `Forbidden key "${key}" at ${path}`);
    }
    const child = readOwnDataProperty(value, key, `${path}.${key}`, fail);
    const clonedChild = walkPlainTree(
      child,
      `${path}.${key}`,
      depth + 1,
      policy,
      fail,
      useIngressCodes,
    );
    Object.defineProperty(clone, key, {
      value: clonedChild,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }

  return Object.freeze(clone);
}

export function sanitizePlainTree<T>(
  raw: unknown,
  rootPath: string,
  policy: PlainTreePolicy,
  fail: PlainObjectShieldFail = (message) => ingressFail(rootPath, message),
  useIngressCodes = false,
): T {
  if (raw == null || typeof raw !== "object") {
    if (useIngressCodes) {
      ingressFailCode(rootPath, "NON_OBJECT_ROOT", "root must be a plain object");
    }
    ingressFail(rootPath, "root must be a plain object");
  }
  if (Array.isArray(raw)) {
    if (useIngressCodes) {
      ingressFailCode(rootPath, "ROOT_IS_ARRAY", "root must not be an array");
    }
    ingressFail(rootPath, "root must not be an array");
  }
  return walkPlainTree(raw, rootPath, 0, policy, fail, useIngressCodes) as T;
}

export function deepCloneFreezeFromStorage<T>(
  raw: unknown,
  rootLabel: string,
  options: Partial<IngressSanitizeOptions> | PlainTreePolicy = {},
): T {
  const policy: PlainTreePolicy =
    "clone" in options ? (options as PlainTreePolicy) : policyPluginStorage(options);
  return sanitizePlainTree<T>(
    raw,
    rootLabel,
    policy,
    (message) => ingressFailFromMessage(rootLabel, message),
    true,
  );
}

export function assertPlainObjectShield(
  value: unknown,
  path: string,
  depth: number,
  options: PlainObjectShieldOptions,
  fail: PlainObjectShieldFail,
): void {
  walkPlainTree(
    value,
    path,
    depth,
    {
      allowArrays: false,
      allowFunctions: false,
      maxDepth: options.maxDepth,
      maxKeysPerObject: options.maxKeysPerObject,
      clone: false,
      onLeaf: options.onLeaf,
    },
    fail,
    false,
  );
}

export function clonePlainObjectShield(
  value: unknown,
  path: string,
  depth: number,
  options: PlainObjectShieldOptions,
  fail: PlainObjectShieldFail,
): unknown {
  return walkPlainTree(
    value,
    path,
    depth,
    {
      allowArrays: false,
      allowFunctions: false,
      maxDepth: options.maxDepth,
      maxKeysPerObject: options.maxKeysPerObject,
      clone: true,
      onLeaf: options.onLeaf,
    },
    fail,
    false,
  );
}
