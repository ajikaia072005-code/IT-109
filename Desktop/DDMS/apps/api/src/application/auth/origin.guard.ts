import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const expectedOrigin = new URL(
      this.config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    ).origin;
    if (request.headers.origin !== expectedOrigin) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
    return true;
  }
}
