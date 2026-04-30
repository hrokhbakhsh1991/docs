import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { ROLES_METADATA_KEY } from "./roles.decorator";
import type { Role } from "./roles.enum";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_METADATA_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (allowedRoles.length === 0) {
      return true;
    }

    const role = this.requestContextService.getRole();
    if (!role) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_ROLE",
          message: "Insufficient role for this operation"
        }
      });
    }

    if (!allowedRoles.includes(role as Role)) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_ROLE",
          message: "Insufficient role for this operation"
        }
      });
    }

    return true;
  }
}
