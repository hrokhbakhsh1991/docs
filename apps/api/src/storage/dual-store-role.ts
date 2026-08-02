/**
 * PSR-5h — dual-store role marker for repository factories.
 *
 * Production/prodlike already refuse memory via assertProductionStorageDriver.
 * Remaining InMemory branches are intentional test|dev adapters, not scaffold
 * leftovers marked for silent deletion.
 */
export const DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER =
  "retained_explicit_test_dev_adapter" as const;

export type DualStoreRole = typeof DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;
