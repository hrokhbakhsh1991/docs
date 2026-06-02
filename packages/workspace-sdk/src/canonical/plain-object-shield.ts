/**
 * Defensive plain-object ingress — prototype/proxy/descriptor hardening.
 */

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export type PlainObjectShieldFail = (message: string) => never;

function logIngressRejection(path: string, reason: string): void {
  console.warn(`[canonical-ingress] rejected at ${path}: ${reason}`);
}

function failWithLog(
  fail: PlainObjectShieldFail,
  path: string,
  reason: string,
  message: string,
): never {
  logIngressRejection(path, reason);
  fail(message);
}

/**
 * Reads an own data property without invoking getters.
 */
export function readOwnDataProperty(
  object: object,
  key: string,
  path: string,
  fail: PlainObjectShieldFail,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor == null) {
    failWithLog(fail, path, `missing descriptor for "${key}"`, `Missing property descriptor for "${key}" at ${path}`);
  }
  if (descriptor.get != null || descriptor.set != null) {
    failWithLog(
      fail,
      path,
      `accessor property "${key}"`,
      `Accessor property "${key}" is not allowed at ${path}`,
    );
  }
  if (!("value" in descriptor)) {
    failWithLog(
      fail,
      path,
      `non-data descriptor on "${key}"`,
      `Non-data property descriptor "${key}" is not allowed at ${path}`,
    );
  }
  return descriptor.value;
}

/**
 * Validates stable Object.prototype chain (detects Proxy/getter pollution on [[Prototype]]).
 */
export function assertStablePlainPrototype(
  value: object,
  path: string,
  fail: PlainObjectShieldFail,
): void {
  let proto: object | null;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    failWithLog(
      fail,
      path,
      "prototype introspection trap",
      `Prototype introspection failed at ${path} (possible Proxy trap)`,
    );
  }

  let protoAgain: object | null;
  try {
    protoAgain = Object.getPrototypeOf(value);
  } catch {
    failWithLog(
      fail,
      path,
      "prototype introspection trap",
      `Prototype introspection failed at ${path} (possible Proxy trap)`,
    );
  }

  if (proto !== protoAgain) {
    failWithLog(
      fail,
      path,
      "unstable prototype chain",
      `Unstable prototype at ${path} (proxy or polluted getter)`,
    );
  }

  if (proto !== Object.prototype) {
    failWithLog(fail, path, "non-plain prototype", `Non-plain object at ${path}`);
  }
}

export function rejectExoticLeaf(
  value: unknown,
  path: string,
  fail: PlainObjectShieldFail,
): void {
  if (typeof value === "bigint") {
    failWithLog(fail, path, "BigInt", `BigInt is not allowed at ${path}`);
  }
  if (typeof value === "symbol") {
    failWithLog(fail, path, "Symbol primitive", `Symbol is not allowed at ${path}`);
  }
  if (typeof value === "function") {
    failWithLog(fail, path, "Function primitive", `Function is not allowed at ${path}`);
  }
}

/**
 * Rejects plain objects that mimic array instances (numeric index + length).
 */
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
    failWithLog(
      fail,
      path,
      "array-like object",
      `Array-like plain object (length=${lengthDescriptor.value}) is not allowed at ${path}`,
    );
  }
}

export type PlainObjectShieldOptions = {
  readonly maxDepth: number;
  readonly maxKeysPerObject: number;
  readonly onLeaf: (value: unknown, path: string, depth: number) => void;
};

/**
 * Walks a plain-object tree using descriptor-safe reads (no getter invocation).
 */
export function assertPlainObjectShield(
  value: unknown,
  path: string,
  depth: number,
  options: PlainObjectShieldOptions,
  fail: PlainObjectShieldFail,
): void {
  if (depth > options.maxDepth) {
    fail(`Max depth exceeded at ${path}`);
  }

  if (value == null) {
    options.onLeaf(value, path, depth);
    return;
  }

  if (Array.isArray(value)) {
    failWithLog(fail, path, "array node", `Arrays are not allowed at ${path}`);
  }

  rejectExoticLeaf(value, path, fail);

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    options.onLeaf(value, path, depth);
    return;
  }

  if (typeof value !== "object") {
    failWithLog(fail, path, "unsupported primitive", `Unsupported value at ${path}`);
  }

  assertStablePlainPrototype(value, path, fail);
  rejectArrayLikePlainObject(value, path, fail);

  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    failWithLog(fail, path, "symbol keys", `Symbol keys are not allowed at ${path}`);
  }

  const enumerableKeys = Object.keys(value);
  const ownNames = Object.getOwnPropertyNames(value);
  if (ownNames.length !== enumerableKeys.length) {
    failWithLog(
      fail,
      path,
      "hidden non-enumerable keys",
      `Hidden non-enumerable keys are not allowed at ${path}`,
    );
  }
  for (const key of ownNames) {
    if (!enumerableKeys.includes(key)) {
      failWithLog(
        fail,
        path,
        "hidden non-enumerable keys",
        `Hidden non-enumerable key "${key}" is not allowed at ${path}`,
      );
    }
  }

  if (enumerableKeys.length > options.maxKeysPerObject) {
    fail(`Too many keys at ${path}`);
  }

  for (const key of enumerableKeys) {
    if (FORBIDDEN_KEYS.has(key)) {
      failWithLog(fail, path, `forbidden key "${key}"`, `Forbidden key "${key}" at ${path}`);
    }
    const child = readOwnDataProperty(value, key, `${path}.${key}`, fail);
    assertPlainObjectShield(child, `${path}.${key}`, depth + 1, options, fail);
  }
}

/**
 * Deep-clones via Object.create(Object.prototype) + frozen data descriptors.
 */
export function clonePlainObjectShield(
  value: unknown,
  path: string,
  depth: number,
  options: PlainObjectShieldOptions,
  fail: PlainObjectShieldFail,
): unknown {
  if (depth > options.maxDepth) {
    fail(`Max depth exceeded at ${path}`);
  }

  if (value == null) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    failWithLog(fail, path, "array node", `Arrays are not allowed at ${path}`);
  }

  rejectExoticLeaf(value, path, fail);

  if (typeof value !== "object") {
    failWithLog(fail, path, "unsupported primitive", `Unsupported value at ${path}`);
  }

  assertStablePlainPrototype(value, path, fail);
  rejectArrayLikePlainObject(value, path, fail);

  const clone = Object.create(Object.prototype) as Record<string, unknown>;
  const keys = Object.keys(value);

  if (keys.length > options.maxKeysPerObject) {
    fail(`Too many keys at ${path}`);
  }

  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) {
      failWithLog(fail, path, `forbidden key "${key}"`, `Forbidden key "${key}" at ${path}`);
    }
    const child = readOwnDataProperty(value, key, `${path}.${key}`, fail);
    const clonedChild = clonePlainObjectShield(child, `${path}.${key}`, depth + 1, options, fail);
    Object.defineProperty(clone, key, {
      value: clonedChild,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }

  return Object.freeze(clone);
}
