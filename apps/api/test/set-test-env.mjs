process.env.STORAGE_DRIVER ??= "memory";
process.env.NODE_ENV ??= "test";
process.env.APPS_API_TEST_TIER ??= "trunk";
process.env.OUTBOX_RELAY_ENABLED ??= "false";
process.env.PROJECTION_AUTO_RECONCILE_ENABLED ??= "false";
process.env.P5_VALIDATION_WORKERS_ENABLED ??= "false";
process.env.TENANT_RATE_LIMIT_ENABLED ??= "false";
