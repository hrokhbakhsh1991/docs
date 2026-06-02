import {
  assertStablePlainPrototype,
  readOwnDataProperty,
  rejectArrayLikePlainObject,
  type PlainObjectShieldFail,
} from "../canonical/plain-object-shield";

export type IngressSanitizeOptions = {
  readonly allowArrays: boolean;
  readonly allowFunctions: boolean;
  readonly maxDepth: number;
};

const DEFAULT_OPTIONS: IngressSanitizeOptions = {
  allowArrays: false,
  allowFunctions: false,
  maxDepth: 32,
};

function fail(path: string, message: string): never {
  throw new Error(`Ingress sanitization failed at ${path}: ${message}`);
}

const shieldFail: PlainObjectShieldFail = (message) => {
  fail("<root>", message);
};

function failWithLog(
  failFn: PlainObjectShieldFail,
  _path: string,
  _reason: string,
  message: string,
): never {
  failFn(message);
}

function rejectExoticLeaf(value: unknown, path: string, failFn: PlainObjectShieldFail): void {
  if (typeof value === "bigint") {
    failWithLog(failFn, path, "BigInt", `BigInt is not allowed at ${path}`);
  }
  if (typeof value === "symbol") {
    failWithLog(failFn, path, "Symbol primitive", `Symbol is not allowed at ${path}`);
  }
}

/**
 * Deep-clones storage payloads onto clean Object.prototype buckets,
 * rejects accessors/symbols, then deep-freezes the result.
 */
export function deepCloneFreezeFromStorage<T>(
  raw: unknown,
  rootLabel: string,
  options: Partial<IngressSanitizeOptions> = {},
): T {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  if (raw == null || typeof raw !== "object") {
    fail(rootLabel, "root must be a plain object");
  }
  if (Array.isArray(raw)) {
    fail(rootLabel, "root must not be an array");
  }
  return deepCloneNode(raw, rootLabel, 0, resolved, shieldFail) as T;
}

function deepCloneNode(
  value: unknown,
  path: string,
  depth: number,
  options: IngressSanitizeOptions,
  failFn: PlainObjectShieldFail,
): unknown {
  if (depth > options.maxDepth) {
    failFn(`Max depth exceeded at ${path}`);
  }

  if (typeof value === "function") {
    if (options.allowFunctions) {
      return value;
    }
    failWithLog(failFn, path, "Function primitive", `Function is not allowed at ${path}`);
  }

  rejectExoticLeaf(value, path, failFn);

  if (value == null) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (!options.allowArrays) {
      failFn(`Arrays are not allowed at ${path}`);
    }
    const items = value.map((item, index) =>
      deepCloneNode(item, `${path}[${index}]`, depth + 1, options, failFn),
    );
    return Object.freeze(items);
  }

  if (typeof value !== "object") {
    failWithLog(failFn, path, "unsupported primitive", `Unsupported value at ${path}`);
  }

  assertStablePlainPrototype(value, path, failFn);
  rejectArrayLikePlainObject(value, path, failFn);

  if (Object.getOwnPropertySymbols(value).length > 0) {
    failWithLog(failFn, path, "symbol keys", `Symbol keys are not allowed at ${path}`);
  }

  const enumerableKeys = Object.keys(value);
  const ownNames = Object.getOwnPropertyNames(value);
  if (ownNames.length !== enumerableKeys.length) {
    failWithLog(
      failFn,
      path,
      "hidden non-enumerable keys",
      `Hidden non-enumerable keys are not allowed at ${path}`,
    );
  }

  const clone = Object.create(Object.prototype) as Record<string, unknown>;
  for (const key of enumerableKeys) {
    const child = readOwnDataProperty(value, key, `${path}.${key}`, failFn);
    const clonedChild = deepCloneNode(child, `${path}.${key}`, depth + 1, options, failFn);
    Object.defineProperty(clone, key, {
      value: clonedChild,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }

  return Object.freeze(clone);
}
