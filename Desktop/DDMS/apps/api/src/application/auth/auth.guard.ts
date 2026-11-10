import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '@prisma/client';
import type { Request } from 'express';
import { AuthRepository } from '../../persistence/auth.repository.js';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: RoleName;
  permissions: string[];
  sessionVersion: number;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = this.config.get<string>(
      'AUTH_COOKIE_NAME',
      'ddms_session',
    );
    const token = request.cookies?.[cookieName];
    if (typeof token !== 'string') {
      throw new UnauthorizedException();
    }

    let subject: string;
    let sessionVersion: number;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: unknown;
        ver?: unknown;
      }>(token);
      if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') {
        throw new UnauthorizedException();
      }
      subject = payload.sub;
      sessionVersion = payload.ver;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.authRepository.findSessionUser(subject);
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !user.roleAssignment ||
      user.sessionVersion !== sessionVersion
    ) {
      throw new UnauthorizedException();
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.roleAssignment.role.name,
      permissions: user.roleAssignment.role.permissions.map(
        ({ permission }) => permission.key,
      ),
      sessionVersion,
    };
    return true;
  }
}
