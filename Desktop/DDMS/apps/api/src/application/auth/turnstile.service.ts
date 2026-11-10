import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TurnstileService {
  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<void> {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException(
        'CAPTCHA verification is not configured.',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }),
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'CAPTCHA verification service is unavailable.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'CAPTCHA verification service is unavailable.',
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'CAPTCHA verification returned an invalid response.',
      );
    }

    if (
      typeof result !== 'object' ||
      result === null ||
      !('success' in result) ||
      typeof result.success !== 'boolean' ||
      !('hostname' in result) ||
      typeof result.hostname !== 'string'
    ) {
      throw new ServiceUnavailableException(
        'CAPTCHA verification returned an invalid response.',
      );
    }

    if (!result.success) {
      throw new UnauthorizedException('CAPTCHA verification failed.');
    }

    const expectedHostname = new URL(
      this.config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    ).hostname;
    if (result.hostname.toLowerCase() !== expectedHostname.toLowerCase()) {
      throw new UnauthorizedException('CAPTCHA verification failed.');
    }
  }
}
