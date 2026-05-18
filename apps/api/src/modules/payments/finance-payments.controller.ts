import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { RequireCapability } from "../../common/casl/require-capability.decorator";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { ManualPaymentService } from "./manual-payment.service";
import { ReceiptService } from "../finance/receipts/receipt.service";
import { CreateManualPaymentDto } from "./dto/create-manual-payment.dto";
import { SubmitReceiptDto } from "./dto/submit-receipt.dto";

@ApiTags("Finance")
@Controller("api/v2/finance")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@RequireCapability("module.finance")
@ApiBearerAuth()
export class FinancePaymentsController {
  constructor(
    @Inject(ManualPaymentService) private readonly manualPaymentService: ManualPaymentService,
    @Inject(ReceiptService) private readonly receiptService: ReceiptService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService
  ) {}

  @Get("payments")
  @Roles(UserRole.Member, UserRole.Leader, UserRole.Admin, UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "FinanceManualPayment"))
  @ApiOperation({ summary: "List manual payments for the workspace" })
  async listManualPayments() {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    return this.manualPaymentService.listManualPayments(tenantId);
  }

  @Post("payments/manual")
  @Roles(UserRole.Admin, UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "FinanceManualPayment"))
  @ApiOperation({ summary: "Create a manual payment (debt)" })
  async createManualPayment(@Body() dto: CreateManualPaymentDto) {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    return this.manualPaymentService.createManualPayment({
      tenantId,
      ...dto
    });
  }

  @Post("payments/:id/receipt")
  @Roles(UserRole.Member, UserRole.Leader, UserRole.Admin, UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "FinanceReceipt"))
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a payment receipt" })
  async submitReceipt(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SubmitReceiptDto,
    @UploadedFile() file: Express.Multer.File | undefined
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("file is required");
    }
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    return this.receiptService.submitReceipt({
      tenantId,
      paymentId: id,
      actorUserId: this.requestContextService.getUserId()!,
      actorRole: String(this.requestContextService.getRole() ?? ""),
      file: file.buffer,
      contentType: file.mimetype,
      note: dto.note
    });
  }
}

@ApiTags("Finance Admin")
@Controller("api/v2/admin/finance")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@RequireCapability("module.finance")
@ApiBearerAuth()
export class FinanceAdminReceiptsController {
  constructor(
    @Inject(ReceiptService) private readonly receiptService: ReceiptService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService
  ) {}

  @Get("receipts")
  @Roles(UserRole.Admin, UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "FinanceReceiptReview"))
  @ApiOperation({ summary: "List receipts pending admin review" })
  async listPendingReceipts() {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    return this.receiptService.listPendingReceipts(tenantId);
  }

  @Post("receipts/:id/approve")
  @Roles(UserRole.Admin, UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "FinanceReceiptReview"))
  @ApiOperation({ summary: "Approve a payment receipt" })
  async approveReceipt(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { reviewNote?: string }
  ) {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    const actorId = this.requestContextService.getUserId()!;
    return this.receiptService.approveReceipt({
      tenantId,
      receiptId: id,
      actorId,
      reviewNote: dto.reviewNote
    });
  }

  @Post("receipts/:id/reject")
  @Roles(UserRole.Admin, UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "FinanceReceiptReview"))
  @ApiOperation({ summary: "Reject a payment receipt" })
  async rejectReceipt(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { reviewNote?: string }
  ) {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    const actorId = this.requestContextService.getUserId()!;
    return this.receiptService.rejectReceipt({
      tenantId,
      receiptId: id,
      actorId,
      reviewNote: dto.reviewNote
    });
  }

  @Get("receipts/:id/url")
  @Roles(UserRole.Admin, UserRole.Owner)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "FinanceReceiptReview"))
  @ApiOperation({ summary: "Get a signed URL for a receipt file" })
  async getReceiptUrl(@Param("id", ParseUUIDPipe) id: string) {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    const url = await this.receiptService.getReceiptSignedUrl({
      tenantId,
      receiptId: id
    });
    return { url };
  }
}
