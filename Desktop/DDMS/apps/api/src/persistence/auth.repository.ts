import { Injectable } from '@nestjs/common';
import {
  Prisma,
  RoleName,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';

const sessionUserInclude = {
  roleAssignment: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type SessionUser = Prisma.UserGetPayload<{
  include: typeof sessionUserInclude;
}>;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<SessionUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: sessionUserInclude,
    });
  }

  findSessionUser(userId: string): Promise<SessionUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: sessionUserInclude,
    });
  }

  createPendingUser(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    tokenHash: string;
    tokenExpiresAt: Date;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          passwordHash: input.passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

      await transaction.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: input.tokenHash,
          expiresAt: input.tokenExpiresAt,
        },
      });

      await transaction.auditLog.create({
        data: {
          action: 'REGISTRATION_SUBMITTED',
          targetType: 'USER',
          targetId: user.id,
        },
      });

      return user;
    });
  }

  createResendToken(input: {
    email: string;
    tokenHash: string;
    tokenExpiresAt: Date;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { email: input.email },
        select: { id: true, status: true },
      });
      if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
        return null;
      }

      await transaction.emailVerificationToken.deleteMany({
        where: { userId: user.id },
      });
      await transaction.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: input.tokenHash,
          expiresAt: input.tokenExpiresAt,
        },
      });
      await transaction.auditLog.create({
        data: {
          action: 'EMAIL_VERIFICATION_RESENT',
          targetType: 'USER',
          targetId: user.id,
        },
      });
      return user.id;
    });
  }

  findVerificationToken(tokenHash: string, now: Date) {
    return this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
  }

  completeVerification(tokenId: string, userId: string, now: Date) {
    return this.prisma.$transaction(async (transaction) => {
      const consumedToken = await transaction.emailVerificationToken.deleteMany({
        where: { id: tokenId, expiresAt: { gt: now } },
      });
      if (consumedToken.count !== 1) {
        return false;
      }

      const verifiedUser = await transaction.user.updateMany({
        where: {
          id: userId,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
        },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
        },
      });
      if (verifiedUser.count !== 1) {
        return false;
      }

      const viewerRole = await transaction.role.findUnique({
        where: { name: RoleName.VIEWER_STUDENT },
        select: { id: true },
      });
      if (!viewerRole) {
        throw new Error('The required Viewer role has not been seeded.');
      }

      await transaction.userRole.create({
        data: { userId, roleId: viewerRole.id },
      });

      await transaction.auditLog.create({
        data: {
          action: 'EMAIL_VERIFIED',
          actorId: userId,
          targetType: 'USER',
          targetId: userId,
        },
      });
      return true;
    });
  }

  recordLogin(userId: string) {
    return this.prisma.auditLog.create({
      data: {
        action: 'LOGIN',
        actorId: userId,
        targetType: 'USER',
        targetId: userId,
      },
    });
  }

  recordLogout(userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      });
      await transaction.auditLog.create({
        data: {
          action: 'LOGOUT',
          actorId: userId,
          targetType: 'USER',
          targetId: userId,
        },
      });
    });
  }
}
