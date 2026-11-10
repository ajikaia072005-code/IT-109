import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../../persistence/auth.repository.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { TurnstileService } from './turnstile.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: {
    findByEmail: ReturnType<typeof vi.fn>;
    createPendingUser: ReturnType<typeof vi.fn>;
  };
  let turnstile: { verify: ReturnType<typeof vi.fn> };
  let email: { sendVerificationEmail: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      createPendingUser: vi.fn().mockResolvedValue({ id: 'new-user' }),
    };
    turnstile = { verify: vi.fn().mockResolvedValue(undefined) };
    email = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };

    const config = {
      getOrThrow: vi.fn().mockReturnValue('gmail.com'),
      get: vi.fn((_key: string, defaultValue?: string) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        { provide: TurnstileService, useValue: turnstile },
        { provide: EmailService, useValue: email },
        { provide: JwtService, useValue: { signAsync: vi.fn() } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('creates an unverified account and emails a one-time verification link', async () => {
    await service.register({
      fullName: '  Ada Example ',
      email: 'Ada.Example@gmail.com',
      password: 'a sufficiently long password',
      confirmPassword: 'a sufficiently long password',
      turnstileToken: 'valid-captcha',
    });

    expect(turnstile.verify).toHaveBeenCalledWith('valid-captcha');
    expect(authRepository.createPendingUser).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Ada Example',
        email: 'ada.example@gmail.com',
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      'ada.example@gmail.com',
      expect.any(String),
      'http://localhost:3000',
    );
  });

  it('rejects email addresses outside the configured domain', async () => {
    await expect(
      service.register({
        fullName: 'Ada Example',
        email: 'ada@example.edu',
        password: 'a sufficiently long password',
        confirmPassword: 'a sufficiently long password',
        turnstileToken: 'valid-captcha',
      }),
    ).rejects.toThrow('Registration is limited to gmail.com email addresses.');

    expect(turnstile.verify).not.toHaveBeenCalled();
    expect(authRepository.createPendingUser).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords before processing CAPTCHA or persistence', async () => {
    await expect(
      service.register({
        fullName: 'Ada Example',
        email: 'ada@gmail.com',
        password: 'a sufficiently long password',
        confirmPassword: 'a different long password',
        turnstileToken: 'valid-captcha',
      }),
    ).rejects.toThrow('Passwords do not match.');

    expect(turnstile.verify).not.toHaveBeenCalled();
    expect(authRepository.createPendingUser).not.toHaveBeenCalled();
  });
});
