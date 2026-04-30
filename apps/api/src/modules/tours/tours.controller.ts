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
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CreateTourDto } from "./dto/create-tour.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { TourEntity } from "./entities/tour.entity";
import { ToursService } from "./tours.service";

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER)
  async create(@Body() dto: CreateTourDto): Promise<TourEntity> {
    return this.toursService.createTour(dto);
  }

  @Patch(":tourId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER)
  async update(
    @Param("tourId") tourId: string,
    @Body() dto: UpdateTourDto
  ): Promise<TourEntity> {
    return this.toursService.updateTour(tourId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT, Role.LEADER)
  async list(): Promise<TourEntity[]> {
    return this.toursService.listTours();
  }

  @Get(":tourId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT, Role.LEADER)
  async getById(@Param("tourId") tourId: string): Promise<TourEntity> {
    return this.toursService.getTourById(tourId);
  }
}
