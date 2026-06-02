import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { isWorkspaceUserRole, type UserRole } from "../../common/auth/user-role.enum";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { ROLES_METADATA_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_METADATA_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (allowedRoles.length === 0) {
      return true;
    }

    const role = this.requestContextService.getRole();
    if (!role || !isWorkspaceUserRole(role)) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_ROLE",
          message: "Insufficient role for this operation"
        }
      });
    }

    if (!allowedRoles.includes(role)) {
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
