import { NotificationsRepository } from '../../persistence/notifications.repository.js';
import { EmailService } from '../auth/email.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService email delivery', () => {
  let service: NotificationsService;
  let repository: {
    findDueEmailIds: ReturnType<typeof vi.fn>;
    claimEmail: ReturnType<typeof vi.fn>;
    findClaimedEmail: ReturnType<typeof vi.fn>;
    markEmailSent: ReturnType<typeof vi.fn>;
    scheduleEmailRetry: ReturnType<typeof vi.fn>;
  };
  let email: { sendNotification: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = {
      findDueEmailIds: vi.fn().mockResolvedValue([{ id: 'notice-1' }]),
      claimEmail: vi.fn().mockResolvedValue({ count: 1 }),
      findClaimedEmail: vi.fn().mockResolvedValue({
        id: 'notice-1',
        title: 'Role application approved',
        body: 'Your role was updated.',
        emailAttempts: 1,
        user: { email: 'applicant@gmail.com' },
      }),
      markEmailSent: vi.fn().mockResolvedValue({ count: 1 }),
      scheduleEmailRetry: vi.fn().mockResolvedValue({ count: 1 }),
    };
    email = { sendNotification: vi.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(
      repository as unknown as NotificationsRepository,
      email as unknown as EmailService,
    );
  });

  it('claims and marks queued email as delivered', async () => {
    await service.processPendingEmails();

    expect(repository.claimEmail).toHaveBeenCalledWith(
      'notice-1',
      expect.any(Date),
      expect.any(Date),
      expect.any(String),
    );
    expect(email.sendNotification).toHaveBeenCalledWith(
      'applicant@gmail.com',
      'notice-1',
      'Role application approved',
      'Your role was updated.',
    );
    expect(repository.markEmailSent).toHaveBeenCalledWith(
      'notice-1',
      expect.any(String),
      expect.any(Date),
    );
    expect(repository.scheduleEmailRetry).not.toHaveBeenCalled();
  });

  it('retains failed email for retry with a persisted backoff', async () => {
    email.sendNotification.mockRejectedValue(new Error('SMTP unavailable'));

    await service.processPendingEmails();

    expect(repository.scheduleEmailRetry).toHaveBeenCalledWith(
      'notice-1',
      expect.any(String),
      expect.any(Date),
      'SMTP unavailable',
    );
    expect(repository.markEmailSent).not.toHaveBeenCalled();
  });

  it('does not send an email when another worker owns the lease', async () => {
    repository.claimEmail.mockResolvedValue({ count: 0 });

    await service.processPendingEmails();

    expect(repository.findClaimedEmail).not.toHaveBeenCalled();
    expect(email.sendNotification).not.toHaveBeenCalled();
  });
});
