import { IsNotEmpty, IsString } from "class-validator";

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  inviteToken!: string;
}

