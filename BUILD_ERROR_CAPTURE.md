# BUILD ERROR CAPTURE — `@apps/api`

**Captured:** 2026-05-30  
**Working directory:** `/home/hamed/Music/docs/apps/api`  
**Purpose:** Raw pipeline output bypassing nested monorepo wrappers to isolate exit status 1.

---

## Operation 1 — Native Nest compiler

**Command:**

```bash
cd apps/api && npx nest build
```

**stdout + stderr (complete, unedited):**

```
EXIT_CODE=0
```

**Result:** Nest TypeScript compilation **succeeds**. No compiler errors, no stack trace.

---

## Operation 2 — OpenAPI generator (direct node)

**Command:**

```bash
cd apps/api && NODE_ENV=development node --env-file=.env dist/openapi.generate.js
```

**stdout + stderr (complete, unedited):**

```

```

**Exit status:** `1`

**Note:** The script produces **zero terminal output** despite failing. Root cause: `src/openapi.generate.ts` swallows the rejection:

```typescript
generateOpenApi().catch((_error: unknown) => {
  process.exit(1);
});
```

---

## Full `pnpm run build` pipeline (reference)

**Command:** `cd apps/api && pnpm run build`  
(equivalent to `nest build && node dist/openapi.generate.js`)

**stdout + stderr:**

```
> @apps/api@0.1.0 build /home/hamed/Music/docs/apps/api
> nest build && node dist/openapi.generate.js

 ELIFECYCLE  Command failed with exit code 1.
FULL_BUILD_EXIT=1
```

Nest build completes; failure is isolated to the OpenAPI generation step.

---

## Exposed failure (diagnostic re-run with error logging)

Because Operation 2 is silent, the same OpenAPI bootstrap was re-run with explicit `catch` logging to surface the hidden Nest DI error. This is **not** a different code path — it is the same `DocumentationModule` + `SwaggerModule.createDocument` flow with errors printed instead of discarded.

**Diagnostic command:**

```bash
cd apps/api && NODE_ENV=development node --env-file=.env -e "
require('reflect-metadata');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const { DocumentationModule } = require('./dist/documentation/documentation.module');

(async () => {
  try {
    const app = await NestFactory.create(DocumentationModule, { logger: false, abortOnError: false });
    const config = new DocumentBuilder().setTitle('API v2 Documentation').setVersion('2.0.0').addServer('/api/v2').addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer').build();
    const document = SwaggerModule.createDocument(app, config);
    writeFileSync(join(process.cwd(), 'openapi.json'), JSON.stringify(document, null, 2));
    await app.close();
    console.log('SUCCESS');
  } catch (e) {
    console.error('OPENAPI_ERROR:', e);
    if (e && e.stack) console.error(e.stack);
    process.exit(1);
  }
})();
"
```

**stdout + stderr (complete, unedited):**

```
OPENAPI_ERROR: UnknownDependenciesException [Error]: Nest can't resolve dependencies of the RegistrationsController (RegistrationsService, RegistrationPlacementOrchestrator, IdempotencyService, RequestContextService, TenantBootstrapService, ?, CommandBus). Please make sure that the argument QueryBus at index [5] is available in the DocumentationModule context.

Potential solutions:
- Is DocumentationModule a valid NestJS module?
- If QueryBus is a provider, is it part of the current DocumentationModule?
- If QueryBus is exported from a separate @Module, is that module imported within DocumentationModule?
  @Module({
    imports: [ /* the Module containing QueryBus */ ]
  })

    at Injector.lookupComponentInParentModules (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:262:19)
    at async Injector.resolveComponentInstance (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:215:33)
    at async resolveParam (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:129:38)
    at async Promise.all (index 5)
    at async Injector.resolveConstructorParams (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:144:27)
    at async Injector.loadInstance (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:70:13)
    at async Injector.loadController (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:89:9)
    at async /home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/instance-loader.js:68:13
    at async Promise.all (index 3)
    at async InstanceLoader.createInstancesOfControllers (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/instance-loader.js:67:9) {
  type: 'RegistrationsController',
  context: {
    index: 5,
    dependencies: [
      [class RegistrationsService],
      [class RegistrationPlacementOrchestrator],
      [class IdempotencyService],
      [class RequestContextService],
      [class TenantBootstrapService],
      [class QueryBus extends ObservableBus],
      [class CommandBus extends ObservableBus]
    ],
    name: [class QueryBus extends ObservableBus]
  },
  metadata: { id: '5811428fa022859889e91' },
  moduleRef: { id: '559fc354de43ee5b9cb78' }
}
Error: Nest can't resolve dependencies of the RegistrationsController (RegistrationsService, RegistrationPlacementOrchestrator, IdempotencyService, RequestContextService, TenantBootstrapService, ?, CommandBus). Please make sure that the argument QueryBus at index [5] is available in the DocumentationModule context.

Potential solutions:
- Is DocumentationModule a valid NestJS module?
- If QueryBus is a provider, is it part of the current DocumentationModule?
- If QueryBus is exported from a separate @Module, is that module imported within DocumentationModule?
  @Module({
    imports: [ /* the Module containing QueryBus */ ]
  })

    at Injector.lookupComponentInParentModules (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:262:19)
    at async Injector.resolveComponentInstance (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:215:33)
    at async resolveParam (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:129:38)
    at async Promise.all (index 5)
    at async Injector.resolveConstructorParams (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:144:27)
    at async Injector.loadInstance (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:70:13)
    at async Injector.loadController (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/injector.js:89:9)
    at async /home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/instance-loader.js:68:13
    at async Promise.all (index 3)
    at async InstanceLoader.createInstancesOfControllers (/home/hamed/Music/docs/node_modules/.pnpm/@nestjs+core@10.4.22_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_wv7sonobpk6cc2m3n6ev6bfqdu/node_modules/@nestjs/core/injector/instance-loader.js:67:9)
DIAG_EXIT=1
```

---

## Root cause summary

| Step | Status | Detail |
|---|---|---|
| `npx nest build` | **PASS** (exit 0) | TypeScript compilation clean |
| `node dist/openapi.generate.js` | **FAIL** (exit 1) | Silent failure — error swallowed by `.catch` |
| Underlying violation | **Nest DI** | `RegistrationsController` requires `QueryBus` (and `CommandBus`) at constructor index 5/6, but `DocumentationModule` does not import `CqrsModule` or provide stub `QueryBus`/`CommandBus` providers |

**Affected files:**

- `apps/api/src/openapi.generate.ts` — error handler hides failure
- `apps/api/src/documentation/documentation.module.ts` — missing CQRS providers for OpenAPI doc bootstrap
- `apps/api/src/modules/registrations/registrations.controller.ts` — injects `QueryBus` + `CommandBus`

**Likely fix direction:** Add `CqrsModule` to `DocumentationModule.imports`, or register stub `{ provide: QueryBus, useValue: {} }` and `{ provide: CommandBus, useValue: {} }` alongside existing stub providers (matching pattern used for `RegistrationsService`, `IdempotencyService`, etc.).
