import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateTourDto } from "./dto/create-tour.dto";
import { ListToursQueryDto } from "./dto/list-tours-query.dto";
import { PaginatedToursResponseDto } from "./dto/paginated-tours-response.dto";
import { TourResponseDto } from "./dto/tour-response.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { ToursService } from "./tours.service";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";
import { RegistrationsService } from "../registrations/registrations.service";
import {
  RegistrationResponseDto,
  WaitlistItemResponseDto
} from "../registrations/dto/get-registration.dto";

@ApiTags("Tours")
@Controller("api/v2/tours")
@UseInterceptors(ClassSerializerInterceptor)
export class ToursController {
  constructor(
    private readonly toursService: ToursService,
    private readonly registrationsService: RegistrationsService
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @ApiOperation({ summary: "Create tour" })
  @ApiCreatedResponse({ type: TourResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER)
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/tours",
    statusCode: 201,
    required: true,
    tenantSource: "context"
  })
  async create(@Body() dto: CreateTourDto): Promise<TourResponseDto> {
    return this.toursService.createTour(dto);
  }

  @Patch(":tourId")
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for update mutation."
  })
  @ApiOperation({ summary: "Update tour by id" })
  @ApiOkResponse({ type: TourResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER)
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/tours/:tourId",
    statusCode: 200,
    required: true,
    tenantSource: "context"
  })
  async update(
    @Param("tourId") tourId: string,
    @Body() dto: UpdateTourDto
  ): Promise<TourResponseDto> {
    return this.toursService.updateTour(tourId, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "List tours in tenant scope (search + pagination)" })
  @ApiQuery({
    name: "page",
    required: false,
    description: "1-based page index",
    schema: { default: 1, minimum: 1 }
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Page size (max 100)",
    schema: { default: 10, minimum: 1, maximum: 100 }
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Lifecycle bucket: active (draft), completed (open), archived (closed/cancelled)",
    enum: ["active", "completed", "archived"]
  })
  @ApiOkResponse({ type: PaginatedToursResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT, Role.LEADER)
  async list(@Query() query: ListToursQueryDto): Promise<PaginatedToursResponseDto> {
    const { items, total, page, limit } = await this.toursService.listTours(query);
    return { items, total, page, limit };
  }

  @Get(":tourId/registrations")
  @ApiBearerAuth()
  @ApiOperation({ summary: "List registrations for tour (Leader workspace)" })
  @ApiOkResponse({ type: RegistrationResponseDto, isArray: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER)
  async listTourRegistrations(
    @Param("tourId", new ParseUUIDPipe()) tourId: string
  ): Promise<RegistrationResponseDto[]> {
    return this.registrationsService.listRegistrationsForTour(tourId);
  }

  @Get(":tourId/waitlist-items")
  @ApiBearerAuth()
  @ApiOperation({ summary: "List waitlist items for tour (Leader workspace)" })
  @ApiOkResponse({ type: WaitlistItemResponseDto, isArray: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER)
  async listTourWaitlist(
    @Param("tourId", new ParseUUIDPipe()) tourId: string
  ): Promise<WaitlistItemResponseDto[]> {
    return this.registrationsService.listWaitlistItemsForTour(tourId);
  }

  @Get(":tourId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get tour by id" })
  @ApiOkResponse({ type: TourResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT, Role.LEADER)
  async getById(@Param("tourId") tourId: string): Promise<TourResponseDto> {
    return this.toursService.getTourById(tourId);
  }
}
