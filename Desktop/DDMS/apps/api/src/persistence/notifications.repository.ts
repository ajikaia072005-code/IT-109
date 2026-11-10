import { Injectable } from '@nestjs/common';
import { EmailDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';

const notificationInclude = {
  user: { select: { email: true } },
} satisfies Prisma.NotificationInclude;

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string, limit: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count > 0) {
      return true;
    }

    return this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    }).then(Boolean);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  findDueEmailIds(now: Date, limit: number): Promise<Array<{ id: string }>> {
    return this.prisma.notification.findMany({
      where: {
        OR: [
          {
            emailStatus: EmailDeliveryStatus.PENDING,
            emailNextAttemptAt: { lte: now },
          },
          {
            emailStatus: EmailDeliveryStatus.SENDING,
            emailLeaseUntil: { lte: now },
          },
        ],
      },
      orderBy: [{ emailNextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: { id: true },
    });
  }

  claimEmail(
    id: string,
    now: Date,
    leaseUntil: Date,
    leaseId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: {
        id,
        OR: [
          {
            emailStatus: EmailDeliveryStatus.PENDING,
            emailNextAttemptAt: { lte: now },
          },
          {
            emailStatus: EmailDeliveryStatus.SENDING,
            emailLeaseUntil: { lte: now },
          },
        ],
      },
      data: {
        emailStatus: EmailDeliveryStatus.SENDING,
        emailAttempts: { increment: 1 },
        emailLeaseUntil: leaseUntil,
        emailLeaseId: leaseId,
        emailLastError: null,
      },
    });
  }

  findClaimedEmail(id: string, leaseId: string) {
    return this.prisma.notification.findFirst({
      where: {
        id,
        emailStatus: EmailDeliveryStatus.SENDING,
        emailLeaseId: leaseId,
      },
      include: notificationInclude,
    });
  }

  markEmailSent(id: string, leaseId: string, now: Date) {
    return this.prisma.notification.updateMany({
      where: {
        id,
        emailStatus: EmailDeliveryStatus.SENDING,
        emailLeaseId: leaseId,
      },
      data: {
        emailStatus: EmailDeliveryStatus.SENT,
        emailSentAt: now,
        emailLeaseUntil: null,
        emailLeaseId: null,
        emailLastError: null,
      },
    });
  }

  scheduleEmailRetry(
    id: string,
    leaseId: string,
    nextAttemptAt: Date,
    error: string,
  ) {
    return this.prisma.notification.updateMany({
      where: {
        id,
        emailStatus: EmailDeliveryStatus.SENDING,
        emailLeaseId: leaseId,
      },
      data: {
        emailStatus: EmailDeliveryStatus.PENDING,
        emailNextAttemptAt: nextAttemptAt,
        emailLeaseUntil: null,
        emailLeaseId: null,
        emailLastError: error.slice(0, 1000),
      },
    });
  }
}
