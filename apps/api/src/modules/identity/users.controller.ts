import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@Controller("api/v2/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.OWNER, Role.ADMIN, Role.LEADER)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List tenant users" })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  async listUsers(): Promise<UserResponseDto[]> {
    return this.usersService.listUsers();
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change user role in tenant scope" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Insufficient role or tenant context" })
  @ApiNotFoundResponse({ description: "User membership not found in tenant" })
  async updateUserRole(
    @Param("id") id: string,
    @Body() payload: UpdateUserRoleDto
  ): Promise<UserResponseDto> {
    return this.usersService.updateUserRole(id, payload.role);
  }
}
