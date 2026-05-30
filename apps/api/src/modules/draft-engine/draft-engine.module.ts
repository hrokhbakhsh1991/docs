import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { createDefaultDraftMigratorRegistry, DraftMigratorRegistry } from "@repo/shared-contracts";
import { CaslModule } from "../../common/casl/casl.module";
import { LoggerModule } from "../../common/logger/logger.module";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuthModule } from "../auth/auth.module";
import { registerTourDraftMigrators } from "./adapters/tour-draft-migrators.provider";
import { DraftEventEntity } from "./entities/draft-event.entity";
import { DraftSnapshotEntity } from "./entities/draft-snapshot.entity";
import { DraftEngineController } from "./draft-engine.controller";
import { DraftEngineFacade } from "./draft-engine.facade";
import { DraftEngineService } from "./draft-engine.service";
import { DraftEngineAbilitiesGuard } from "./guards/draft-engine-abilities.guard";
import { DRAFT_ENGINE_ACCESS_POLICY } from "./policies/draft-engine-access.policy";
import { tourCreateDraftAccessPolicy } from "./policies/tour-create-draft-access.policy";
import { DefaultDraftConflictResolver } from "./domain/default-draft-conflict-resolver";
import { DRAFT_CONFLICT_RESOLVER_PORT } from "./domain/ports/draft-conflict-resolver.port";
import { DRAFT_EVENTS_PORT } from "./domain/ports/draft-events.port";
import { DRAFT_STORAGE_PORT } from "./domain/ports/draft-storage.port";
import { DraftScopeResolver } from "./storage/draft-scope.resolver";
import { PostgresDraftSnapshotStore } from "./repositories/postgres-draft-snapshot.store";
import { TypeOrmDraftEventsRepository } from "./repositories/typeorm-draft-events.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([DraftSnapshotEntity, DraftEventEntity]),
    AuthModule,
    RequestContextModule,
    CaslModule,
    LoggerModule,
  ],
  controllers: [DraftEngineController],
  providers: [
    DraftScopeResolver,
    PostgresDraftSnapshotStore,
    TypeOrmDraftEventsRepository,
    {
      provide: DraftMigratorRegistry,
      useFactory: () => {
        const registry = createDefaultDraftMigratorRegistry();
        registerTourDraftMigrators(registry);
        return registry;
      },
    },
    DraftEngineFacade,
    DraftEngineService,
    DefaultDraftConflictResolver,
    {
      provide: DRAFT_STORAGE_PORT,
      useExisting: PostgresDraftSnapshotStore,
    },
    {
      provide: DRAFT_EVENTS_PORT,
      useExisting: TypeOrmDraftEventsRepository,
    },
    {
      provide: DRAFT_CONFLICT_RESOLVER_PORT,
      useExisting: DefaultDraftConflictResolver,
    },
    DraftEngineAbilitiesGuard,
    {
      provide: DRAFT_ENGINE_ACCESS_POLICY,
      useValue: tourCreateDraftAccessPolicy,
    },
  ],
  exports: [DraftEngineFacade, DraftEngineService, DRAFT_ENGINE_ACCESS_POLICY],
})
export class DraftEngineModule {}
