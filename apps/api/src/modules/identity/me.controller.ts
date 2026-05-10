import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ChangeMobileRequestDto } from "./dto/change-mobile-request.dto";
import { ChangeMobileVerifyDto } from "./dto/change-mobile-verify.dto";
import { PatchMeDto } from "./dto/patch-me.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { MeService } from "./me.service";

@Controller("api/v2/me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  async getMe() {
    return this.meService.getMe();
  }

  @Patch()
  async patchMe(@Body() dto: PatchMeDto) {
    return this.meService.patchMe(dto);
  }

  @Post("verify-email")
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.meService.verifyEmail(dto.token);
  }

  @Post("change-mobile/request")
  @HttpCode(200)
  async requestChangeMobile(@Body() dto: ChangeMobileRequestDto) {
    return this.meService.requestChangeMobile(dto.new_mobile);
  }

  @Post("change-mobile/verify")
  @HttpCode(200)
  async verifyChangeMobile(@Body() dto: ChangeMobileVerifyDto) {
    return this.meService.verifyChangeMobile(dto.challenge_id, dto.code);
  }
}
