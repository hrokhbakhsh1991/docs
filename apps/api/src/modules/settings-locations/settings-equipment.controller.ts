import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateEquipmentItemDto } from "./dto/create-equipment-item.dto";
import { ReorderEquipmentItemsDto } from "./dto/reorder-equipment-items.dto";
import { UpdateEquipmentItemDto } from "./dto/update-equipment-item.dto";
import { WorkspaceEquipmentItemResponseDto } from "./dto/workspace-equipment-item-response.dto";
import { EquipmentSettingsService } from "./equipment-settings.service";

@ApiTags("Settings — Equipment")
@Controller("api/v2/settings/equipment")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsEquipmentController {
  constructor(private readonly equipment: EquipmentSettingsService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.PARTICIPANT)
  @ApiOperation({
    summary: "List workspace equipment items",
    description: "Readable by all workspace members (for tour UI). Create/update/delete remain owner/admin only."
  })
  @ApiOkResponse({ type: WorkspaceEquipmentItemResponseDto, isArray: true })
  async list(): Promise<WorkspaceEquipmentItemResponseDto[]> {
    return this.equipment.findAllByWorkspace();
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Create workspace equipment item" })
  @ApiCreatedResponse({ type: WorkspaceEquipmentItemResponseDto })
  async create(@Body() dto: CreateEquipmentItemDto): Promise<WorkspaceEquipmentItemResponseDto> {
    return this.equipment.create(dto);
  }

  @Patch("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Reorder workspace equipment items (full id list)" })
  @ApiOkResponse({ type: WorkspaceEquipmentItemResponseDto, isArray: true })
  async reorder(
    @Body() dto: ReorderEquipmentItemsDto
  ): Promise<WorkspaceEquipmentItemResponseDto[]> {
    return this.equipment.reorder(dto.itemIds);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Update workspace equipment item" })
  @ApiOkResponse({ type: WorkspaceEquipmentItemResponseDto })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEquipmentItemDto
  ): Promise<WorkspaceEquipmentItemResponseDto> {
    return this.equipment.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Delete workspace equipment item" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.equipment.remove(id);
  }
}
