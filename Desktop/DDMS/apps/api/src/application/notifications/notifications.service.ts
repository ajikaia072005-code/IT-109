import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EmailService } from '../auth/email.service.js';
import { NotificationsRepository } from '../../persistence/notifications.repository.js';

const EMAIL_BATCH_SIZE = 20;
const EMAIL_LEASE_MS = 60_000;
const POLL_INTERVAL_MS = 15_000;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly repository: NotificationsRepository,
    private readonly email: EmailService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processPendingEmails();
    }, POLL_INTERVAL_MS);
    this.timer.unref();
    void this.processPendingEmails();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  listForUser(userId: string, limit: number) {
    return this.repository.listForUser(userId, limit);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    if (!(await this.repository.markRead(userId, notificationId))) {
      throw new NotFoundException('Notification was not found.');
    }
  }

  markAllRead(userId: string): Promise<number> {
    return this.repository.markAllRead(userId);
  }

  async processPendingEmails(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      const due = await this.repository.findDueEmailIds(
        new Date(),
        EMAIL_BATCH_SIZE,
      );
      for (const { id } of due) {
        await this.deliverOne(id);
      }
    } catch (error) {
      this.logger.error(
        'Failed to process pending notification emails.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.processing = false;
    }
  }

  private async deliverOne(id: string): Promise<void> {
    const now = new Date();
    const leaseId = randomUUID();
    const claim = await this.repository.claimEmail(
      id,
      now,
      new Date(now.getTime() + EMAIL_LEASE_MS),
      leaseId,
    );
    if (claim.count !== 1) {
      return;
    }

    const notification = await this.repository.findClaimedEmail(id, leaseId);
    if (!notification) {
      return;
    }

    try {
      await this.email.sendNotification(
        notification.user.email,
        notification.id,
        notification.title,
        notification.body,
      );
      await this.repository.markEmailSent(id, leaseId, new Date());
    } catch (error) {
      const delaySeconds = Math.min(
        60 * 2 ** Math.min(notification.emailAttempts - 1, 10),
        6 * 60 * 60,
      );
      await this.repository.scheduleEmailRetry(
        id,
        leaseId,
        new Date(Date.now() + delaySeconds * 1000),
        error instanceof Error ? error.message : 'Unknown SMTP delivery error.',
      );
      this.logger.warn(
        `Notification email ${id} is queued for retry in ${delaySeconds} seconds.`,
      );
    }
  }
}
