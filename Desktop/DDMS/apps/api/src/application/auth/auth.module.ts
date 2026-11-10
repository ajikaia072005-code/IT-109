import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthRepository } from '../../persistence/auth.repository.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { OriginGuard } from './origin.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import { TurnstileService } from './turnstile.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (
          Buffer.byteLength(secret, 'utf8') < 32 ||
          secret.startsWith('replace-with-')
        ) {
          throw new Error('JWT_SECRET must be at least 32 bytes.');
        }
        return { secret, signOptions: { expiresIn: 8 * 60 * 60 } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    AuthGuard,
    PermissionsGuard,
    OriginGuard,
    EmailService,
    TurnstileService,
  ],
  exports: [
    JwtModule,
    AuthRepository,
    AuthGuard,
    PermissionsGuard,
    OriginGuard,
    EmailService,
  ],
})
export class AuthModule {}
