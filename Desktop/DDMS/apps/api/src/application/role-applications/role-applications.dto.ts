import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { RoleName } from '@prisma/client';

export class SubmitRoleApplicationDto {
  @IsEnum(RoleName)
  requestedRole!: RoleName;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
