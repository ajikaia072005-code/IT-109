import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import {
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  VerifyEmailDto,
} from './auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() input: RegisterDto) {
    await this.auth.register(input);
    return { message: 'Check your email for a verification link.' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input);
    response.cookie(
      this.cookieName(),
      result.accessToken,
      this.cookieOptions(),
    );
    return { user: result.user };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(@Body() input: VerifyEmailDto) {
    await this.auth.verifyEmail(input.token);
    return { verified: true };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendVerification(@Body() input: ResendVerificationDto) {
    await this.auth.resendVerification(input);
    return {
      message: 'If the account is pending verification, an email will be sent.',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.user!.id);
    response.clearCookie(this.cookieName(), this.cookieOptions());
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() request: AuthenticatedRequest) {
    return this.auth.getCurrentUser(request.user!.id);
  }

  private cookieName(): string {
    return this.config.get<string>('AUTH_COOKIE_NAME', 'ddms_session');
  }

  private cookieOptions(): CookieOptions {
    const sameSite = this.config.get<string>('AUTH_COOKIE_SAME_SITE', 'lax');
    if (!['strict', 'lax', 'none'].includes(sameSite)) {
      throw new Error('AUTH_COOKIE_SAME_SITE must be strict, lax, or none.');
    }

    const secure =
      this.config.get<string>('AUTH_COOKIE_SECURE') === 'true' ||
      process.env.NODE_ENV === 'production';
    if (sameSite === 'none' && !secure) {
      throw new Error('SameSite=None requires AUTH_COOKIE_SECURE=true.');
    }

    const domain = this.config.get<string>('AUTH_COOKIE_DOMAIN');
    return {
      httpOnly: true,
      secure,
      sameSite: sameSite as CookieOptions['sameSite'],
      path: '/',
      maxAge: AuthService.sessionTtlSeconds * 1000,
      ...(domain ? { domain } : {}),
    };
  }
}
