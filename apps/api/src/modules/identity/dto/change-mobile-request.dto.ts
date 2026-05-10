import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

import { normalizeOtpPhoneInput } from "../../../common/phone/otp-phone-normalize";

export class ChangeMobileRequestDto {
  @Transform(({ value }) => (typeof value === "string" ? normalizeOtpPhoneInput(value) : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: "new_mobile must contain at least 8 significant characters" })
  new_mobile!: string;
}
