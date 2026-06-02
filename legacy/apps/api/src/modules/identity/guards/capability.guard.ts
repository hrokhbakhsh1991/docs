import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { assertJwtCapsSatisfyRequireCapability } from "../../../common/casl/evaluate-jwt-capability-snapshot";
import { REQUIRE_CAPABILITY_KEY } from "../../../common/casl/require-capability.decorator";
import { RequestContextService } from "../../../common/request-context/request-context.service";

/**
 * Phase 16 — JWT `caps` fast-rejection gate for {@link RequireCapability} routes.
 * {@link AbilitiesGuard} continues DB/ALS verification (defense in depth).
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndMerge<readonly string[]>(REQUIRE_CAPABILITY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    assertJwtCapsSatisfyRequireCapability(
      required,
      this.requestContext.tryGetJwtCapabilitySnapshot(),
      this.requestContext.getRole(),
    );
    return true;
  }
}
