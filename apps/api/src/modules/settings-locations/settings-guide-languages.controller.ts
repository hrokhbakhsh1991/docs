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
import { CreateGuideLanguageDto } from "./dto/create-guide-language.dto";
import { ReorderGuideLanguagesDto } from "./dto/reorder-guide-languages.dto";
import { UpdateGuideLanguageDto } from "./dto/update-guide-language.dto";
import { WorkspaceGuideLanguageResponseDto } from "./dto/workspace-guide-language-response.dto";
import { GuideLanguagesSettingsService } from "./guide-languages-settings.service";

@ApiTags("Settings — Guide languages")
@Controller("api/v2/settings/guide-languages")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsGuideLanguagesController {
  constructor(private readonly guideLanguages: GuideLanguagesSettingsService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.PARTICIPANT)
  @ApiOperation({
    summary: "List workspace guide languages",
    description: "Readable by all workspace members (for tour UI). Create/update/delete remain owner/admin only."
  })
  @ApiOkResponse({ type: WorkspaceGuideLanguageResponseDto, isArray: true })
  async list(): Promise<WorkspaceGuideLanguageResponseDto[]> {
    return this.guideLanguages.findAllByWorkspace();
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Create workspace guide language" })
  @ApiCreatedResponse({ type: WorkspaceGuideLanguageResponseDto })
  async create(@Body() dto: CreateGuideLanguageDto): Promise<WorkspaceGuideLanguageResponseDto> {
    return this.guideLanguages.create(dto);
  }

  @Patch("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Reorder workspace guide languages (full id list)" })
  @ApiOkResponse({ type: WorkspaceGuideLanguageResponseDto, isArray: true })
  async reorder(@Body() dto: ReorderGuideLanguagesDto): Promise<WorkspaceGuideLanguageResponseDto[]> {
    return this.guideLanguages.reorder(dto.itemIds);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Update workspace guide language" })
  @ApiOkResponse({ type: WorkspaceGuideLanguageResponseDto })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGuideLanguageDto
  ): Promise<WorkspaceGuideLanguageResponseDto> {
    return this.guideLanguages.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Delete workspace guide language" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.guideLanguages.remove(id);
  }
}
