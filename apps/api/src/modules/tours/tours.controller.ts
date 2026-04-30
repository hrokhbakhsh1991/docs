import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateTourDto } from "./dto/create-tour.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { TourEntity } from "./entities/tour.entity";
import { ToursService } from "./tours.service";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";

@ApiTags("Tours")
@Controller("api/v2/tours")
@UseInterceptors(ClassSerializerInterceptor)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  })
)
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create tour" })
  @ApiCreatedResponse({ type: TourEntity })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER)
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/tours",
    statusCode: 201,
    required: true,
    tenantSource: "context"
  })
  async create(@Body() dto: CreateTourDto): Promise<TourEntity> {
    return this.toursService.createTour(dto);
  }

  @Patch(":tourId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update tour by id" })
  @ApiOkResponse({ type: TourEntity })
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
  ): Promise<TourEntity> {
    return this.toursService.updateTour(tourId, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "List tours in tenant scope" })
  @ApiOkResponse({ type: TourEntity, isArray: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT, Role.LEADER)
  async list(): Promise<TourEntity[]> {
    return this.toursService.listTours();
  }

  @Get(":tourId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get tour by id" })
  @ApiOkResponse({ type: TourEntity })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT, Role.LEADER)
  async getById(@Param("tourId") tourId: string): Promise<TourEntity> {
    return this.toursService.getTourById(tourId);
  }
}
