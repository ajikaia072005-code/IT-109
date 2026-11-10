import { IsEmail, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;

  @IsString()
  @Length(12, 128)
  confirmPassword!: string;

  @IsString()
  @IsNotEmpty()
  turnstileToken!: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  turnstileToken!: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @IsNotEmpty()
  turnstileToken!: string;
}
