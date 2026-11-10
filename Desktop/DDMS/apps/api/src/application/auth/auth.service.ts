import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuthRepository } from '../../persistence/auth.repository.js';
import { EmailService } from './email.service.js';
import {
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
} from './auth.dto.js';
import { TurnstileService } from './turnstile.service.js';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly turnstile: TurnstileService,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto): Promise<void> {
    if (input.password !== input.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    await this.verifyEmailDomain(input.email);
    await this.turnstile.verify(input.turnstileToken);

    const email = input.email.trim().toLowerCase();
    if (await this.authRepository.findByEmail(email)) {
      throw new ConflictException('An account with this email already exists.');
    }

    const fullName = input.fullName.trim();
    if (!fullName) {
      throw new BadRequestException('Full name is required.');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenExpiresAt = new Date(Date.now() + this.verificationTtlMs());

    try {
      await this.authRepository.createPendingUser({
        fullName,
        email,
        passwordHash: await argon2.hash(input.password, {
          type: argon2.argon2id,
        }),
        tokenHash: this.hashToken(rawToken),
        tokenExpiresAt,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw error;
    }

    await this.email.sendVerificationEmail(
      email,
      rawToken,
      this.config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    );
  }

  async login(input: LoginDto) {
    await this.turnstile.verify(input.turnstileToken);
    const user = await this.authRepository.findByEmail(
      input.email.trim().toLowerCase(),
    );

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !user.emailVerifiedAt ||
      !(await argon2.verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    if (!user.roleAssignment) {
      throw new UnauthorizedException('The account has no assigned role.');
    }

    await this.authRepository.recordLogin(user.id);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      ver: user.sessionVersion,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.roleAssignment.role.name,
      },
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const verification = await this.authRepository.findVerificationToken(
      tokenHash,
      new Date(),
    );
    if (!verification) {
      throw new UnauthorizedException(
        'The verification link is invalid or has expired.',
      );
    }

    const verified = await this.authRepository.completeVerification(
      verification.id,
      verification.userId,
      new Date(),
    );
    if (!verified) {
      throw new UnauthorizedException(
        'The verification link is invalid or has expired.',
      );
    }
  }

  async resendVerification(input: ResendVerificationDto): Promise<void> {
    await this.verifyEmailDomain(input.email);
    await this.turnstile.verify(input.turnstileToken);
    this.email.assertConfigured();

    const rawToken = randomBytes(32).toString('base64url');
    const userId = await this.authRepository.createResendToken({
      email: input.email.trim().toLowerCase(),
      tokenHash: this.hashToken(rawToken),
      tokenExpiresAt: new Date(Date.now() + this.verificationTtlMs()),
    });

    if (userId) {
      await this.email.sendVerificationEmail(
        input.email.trim().toLowerCase(),
        rawToken,
        this.config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
      );
    }
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.recordLogout(userId);
  }

  async getCurrentUser(userId: string) {
    const user = await this.authRepository.findSessionUser(userId);
    if (!user || user.status !== 'ACTIVE' || !user.roleAssignment) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.roleAssignment.role.name,
    };
  }

  private async verifyEmailDomain(emailAddress: string): Promise<void> {
    const configuredDomain = this.config
      .getOrThrow<string>('ALLOWED_EMAIL_DOMAIN')
      .trim()
      .toLowerCase()
      .replace(/^@/, '');
    const emailDomain = emailAddress.trim().toLowerCase().split('@').at(-1);
    if (!emailDomain || emailDomain !== configuredDomain) {
      throw new BadRequestException(
        `Registration is limited to ${configuredDomain} email addresses.`,
      );
    }
  }

  private verificationTtlMs(): number {
    const minutes = Number(
      this.config.get<string>('VERIFICATION_TOKEN_TTL_MINUTES', '30'),
    );
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      throw new Error('VERIFICATION_TOKEN_TTL_MINUTES must be 1 through 1440.');
    }
    return minutes * 60 * 1000;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static readonly sessionTtlSeconds = SESSION_TTL_SECONDS;
}
