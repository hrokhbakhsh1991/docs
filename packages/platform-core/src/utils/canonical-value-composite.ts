import {
  assertStablePlainPrototype,
  readOwnDataProperty,
} from "@app-tour/workspace-sdk/canonical";

import { PlatformCoreError } from "../errors/platform-core.error";
import { typeMismatch } from "./canonical-value-text";

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_COMPOSITE_DEPTH = 16;
const MAX_COMPOSITE_KEYS = 500;
const MAX_COMPOSITE_STACK = MAX_COMPOSITE_DEPTH * MAX_COMPOSITE_KEYS;

function compositeFail(canonicalPath: string, message: string): never {
  throw new PlatformCoreError(
    "CANONICAL_TYPE_MISMATCH",
    message,
    { canonicalPath, kind: "composite" },
  );
}

function assertCompositeLeaf(
  leaf: unknown,
  path: string,
  canonicalPath: string,
): void {
  if (leaf == null) {
    return;
  }
  if (typeof leaf === "string" || typeof leaf === "boolean") {
    return;
  }
  if (typeof leaf === "number") {
    if (!Number.isFinite(leaf)) {
      throw typeMismatch(path, "composite", "non-finite number in nested value");
    }
    return;
  }
  if (typeof leaf === "bigint") {
    throw typeMismatch(path, "composite", "BigInt in nested value");
  }
  if (typeof leaf === "symbol") {
    compositeFail(canonicalPath, `Symbol primitive is not allowed at ${path}`);
  }
  compositeFail(canonicalPath, `Unsupported nested value at ${path}`);
}

function assertCompositeNodeObject(
  node: object,
  path: string,
  canonicalPath: string,
): void {
  const fail = (message: string): never => compositeFail(canonicalPath, message);
  assertStablePlainPrototype(node, path, fail);

  if (Object.getOwnPropertySymbols(node).length > 0) {
    compositeFail(canonicalPath, `Symbol keys are not allowed at ${path}`);
  }

  const enumerableKeys = Object.keys(node);
  const ownNames = Object.getOwnPropertyNames(node);
  if (ownNames.length !== enumerableKeys.length) {
    compositeFail(canonicalPath, `Hidden non-enumerable keys are not allowed at ${path}`);
  }

  if (enumerableKeys.length > MAX_COMPOSITE_KEYS) {
    compositeFail(canonicalPath, `Too many keys at ${path}`);
  }
}

/** Flat iterative composite walk — no recursive call frames on hot path. */
export function assertCompositeCanonicalValue(value: unknown, canonicalPath: string): void {
  const compositeNodeStack: unknown[] = [value];
  const compositeDepthStack: number[] = [0];

  while (compositeNodeStack.length > 0) {
    const node = compositeNodeStack.pop()!;
    const depth = compositeDepthStack.pop()!;

    if (depth > MAX_COMPOSITE_DEPTH) {
      compositeFail(
        canonicalPath,
        `composite at "${canonicalPath}" exceeds max nested depth (${MAX_COMPOSITE_DEPTH})`,
      );
    }

    if (node == null || typeof node !== "object" || Array.isArray(node)) {
      compositeFail(canonicalPath, `composite at "${canonicalPath}" must be a plain object`);
    }

    assertCompositeNodeObject(node, canonicalPath, canonicalPath);
    const fail = (message: string): never => compositeFail(canonicalPath, message);
    const record = node as Record<string, unknown>;
    const keys = Object.keys(record);

    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!;
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        compositeFail(
          canonicalPath,
          `composite at "${canonicalPath}" contains forbidden key "${key}"`,
        );
      }

      const childPath = `${canonicalPath}.${key}`;
      const child = readOwnDataProperty(record, key, childPath, fail);

      if (child == null) {
        continue;
      }

      if (typeof child === "object" && !Array.isArray(child)) {
        if (compositeNodeStack.length >= MAX_COMPOSITE_STACK) {
          compositeFail(canonicalPath, `composite at "${canonicalPath}" exceeds walk stack limit`);
        }
        compositeNodeStack.push(child);
        compositeDepthStack.push(depth + 1);
      } else {
        assertCompositeLeaf(child, childPath, canonicalPath);
      }
    }
  }
}
