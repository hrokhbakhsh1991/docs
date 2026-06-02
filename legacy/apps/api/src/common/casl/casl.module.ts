import { Global, Module } from "@nestjs/common";
import { AbilitiesGuard } from "./abilities.guard";
import { CaslMirrorAbilitiesGuard } from "./casl-mirror-abilities.guard";
import { WorkspaceAbilityFactoryService } from "./workspace-ability.factory.service";

@Global()
@Module({
  providers: [WorkspaceAbilityFactoryService, AbilitiesGuard, CaslMirrorAbilitiesGuard],
  exports: [WorkspaceAbilityFactoryService, AbilitiesGuard, CaslMirrorAbilitiesGuard]
})
export class CaslModule {}
