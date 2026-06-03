export {
  assertCanonicalDocument,
  assertCanonicalDocumentRoots,
  assertCanonicalPathSegments,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  freezeCanonicalDocumentData,
  type CanonicalDocument,
  type CanonicalDocumentValidationErrorCode,
} from "./canonical-document";

export {
  assertPlainObjectShield,
  assertStablePlainPrototype,
  deepCloneFreezeFromStorage,
  readOwnDataProperty,
  sanitizePlainTree,
  type IngressSanitizeOptions,
  type PlainTreePolicy,
} from "./plain-object-shield";
