import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { createDefaultDraftMigratorRegistry, DraftMigratorRegistry } from "@repo/shared-contracts";
import { CaslModule } from "../../common/casl/casl.module";
import { LoggerModule } from "../../common/logger/logger.module";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuthModule } from "../auth/auth.module";
import { registerTourDraftMigrators } from "./adapters/tour-draft-migrators.provider";
import { DraftSnapshotEntity } from "./entities/draft-snapshot.entity";
import { DraftEngineController } from "./draft-engine.controller";
import { DraftEngineFacade } from "./draft-engine.facade";
import { DraftEngineService } from "./draft-engine.service";
import { DraftEngineAbilitiesGuard } from "./guards/draft-engine-abilities.guard";
import { DRAFT_ENGINE_ACCESS_POLICY } from "./policies/draft-engine-access.policy";
import { tourCreateDraftAccessPolicy } from "./policies/tour-create-draft-access.policy";
import { DraftScopeResolver } from "./storage/draft-scope.resolver";
import { PostgresDraftSnapshotStore } from "./storage/postgres-draft-snapshot.store";

@Module({
  imports: [
    TypeOrmModule.forFeature([DraftSnapshotEntity]),
    AuthModule,
    RequestContextModule,
    CaslModule,
    LoggerModule,
  ],
  controllers: [DraftEngineController],
  providers: [
    DraftScopeResolver,
    PostgresDraftSnapshotStore,
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
    DraftEngineAbilitiesGuard,
    {
      provide: DRAFT_ENGINE_ACCESS_POLICY,
      useValue: tourCreateDraftAccessPolicy,
    },
  ],
  exports: [DraftEngineFacade, DraftEngineService, DRAFT_ENGINE_ACCESS_POLICY],
})
export class DraftEngineModule {}
