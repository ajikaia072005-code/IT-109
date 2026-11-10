import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  RoleApplicationStatus,
  RoleName,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';

const APPLICATION_REVIEW_INCLUDE = {
  applicant: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.RoleApplicationInclude;

@Injectable()
export class RoleApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForApplicant(userId: string) {
    return this.prisma.roleApplication.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        requestedRole: true,
        reason: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNote: true,
      },
    });
  }

  listPending() {
    return this.prisma.roleApplication.findMany({
      where: { status: RoleApplicationStatus.PENDING },
      orderBy: { submittedAt: 'asc' },
      include: APPLICATION_REVIEW_INCLUDE,
    });
  }

  async submit(userId: string, requestedRole: RoleName, reason: string) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const user = await transaction.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              status: true,
              roleAssignment: { select: { role: { select: { name: true } } } },
            },
          });
          if (
            !user ||
            user.status !== UserStatus.ACTIVE ||
            user.roleAssignment?.role.name !== RoleName.VIEWER_STUDENT
          ) {
            throw new ConflictException(
              'Only active Viewer accounts may apply for another role.',
            );
          }

          const pending = await transaction.roleApplication.findFirst({
            where: { userId, status: RoleApplicationStatus.PENDING },
            select: { id: true },
          });
          if (pending) {
            throw new ConflictException(
              'You already have a pending role application.',
            );
          }

          const admins = await transaction.user.findMany({
            where: {
              status: UserStatus.ACTIVE,
              roleAssignment: {
                is: { role: { is: { name: RoleName.SYSTEM_ADMIN } } },
              },
            },
            select: { id: true },
          });
          if (admins.length === 0) {
            throw new ServiceUnavailableException(
              'Role applications are unavailable until a System Admin is provisioned.',
            );
          }

          const application = await transaction.roleApplication.create({
            data: {
              userId,
              requestedRole,
              reason: reason.trim(),
              status: RoleApplicationStatus.PENDING,
            },
            select: {
              id: true,
              requestedRole: true,
              reason: true,
              status: true,
              submittedAt: true,
              reviewedAt: true,
            },
          });

          await transaction.auditLog.create({
            data: {
              action: 'ROLE_APPLICATION_SUBMITTED',
              actorId: userId,
              targetType: 'ROLE_APPLICATION',
              targetId: application.id,
              metadata: { requestedRole },
            },
          });

          await transaction.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              type: 'ROLE_APPLICATION_SUBMITTED',
              title: 'Role application submitted',
              body: `A user has applied for the ${requestedRole.replaceAll('_', ' ')} role.`,
            })),
          });

          return application;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You already have a pending role application.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Role application state changed. Please try again.',
        );
      }
      throw error;
    }
  }

  async review(
    applicationId: string,
    reviewerId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const application = await transaction.roleApplication.findUnique({
            where: { id: applicationId },
            include: APPLICATION_REVIEW_INCLUDE,
          });
          if (!application) {
            throw new NotFoundException('Role application was not found.');
          }
          if (application.status !== RoleApplicationStatus.PENDING) {
            throw new ConflictException(
              'This role application has already been reviewed.',
            );
          }
          if (application.userId === reviewerId) {
            throw new ConflictException(
              'You cannot review your own role application.',
            );
          }

          if (decision === 'APPROVED') {
            const applicant = await transaction.user.findUnique({
              where: { id: application.userId },
              select: { status: true },
            });
            if (applicant?.status !== UserStatus.ACTIVE) {
              throw new ConflictException(
                'Only active applicants can be assigned a new role.',
              );
            }

            const viewerAssignment = await transaction.userRole.findUnique({
              where: { userId: application.userId },
              select: { roleId: true, role: { select: { name: true } } },
            });
            if (viewerAssignment?.role.name !== RoleName.VIEWER_STUDENT) {
              throw new ConflictException(
                'The applicant is no longer assigned the Viewer role.',
              );
            }

            const targetRole = await transaction.role.findUnique({
              where: { name: application.requestedRole },
              select: { id: true },
            });
            if (!targetRole) {
              throw new ServiceUnavailableException(
                'The requested role has not been seeded.',
              );
            }

            const assignment = await transaction.userRole.updateMany({
              where: {
                userId: application.userId,
                roleId: viewerAssignment.roleId,
              },
              data: { roleId: targetRole.id, assignedAt: new Date() },
            });
            if (assignment.count !== 1) {
              throw new ConflictException(
                'The applicant role changed while the application was reviewed.',
              );
            }

            await transaction.user.update({
              where: { id: application.userId },
              data: { sessionVersion: { increment: 1 } },
            });
          }

          const reviewedAt = new Date();
          const update = await transaction.roleApplication.updateMany({
            where: {
              id: applicationId,
              status: RoleApplicationStatus.PENDING,
            },
            data: {
              status:
                decision === 'APPROVED'
                  ? RoleApplicationStatus.APPROVED
                  : RoleApplicationStatus.REJECTED,
              reviewedAt,
              reviewedById: reviewerId,
            },
          });
          if (update.count !== 1) {
            throw new ConflictException(
              'This role application has already been reviewed.',
            );
          }

          await transaction.auditLog.create({
            data: {
              action:
                decision === 'APPROVED'
                  ? 'ROLE_APPLICATION_APPROVED'
                  : 'ROLE_APPLICATION_REJECTED',
              actorId: reviewerId,
              targetType: 'ROLE_APPLICATION',
              targetId: application.id,
              metadata: {
                applicantId: application.userId,
                requestedRole: application.requestedRole,
              },
            },
          });

          await transaction.notification.create({
            data: {
              userId: application.userId,
              type:
                decision === 'APPROVED'
                  ? 'ROLE_APPLICATION_APPROVED'
                  : 'ROLE_APPLICATION_REJECTED',
              title:
                decision === 'APPROVED'
                  ? 'Role application approved'
                  : 'Role application rejected',
              body:
                decision === 'APPROVED'
                  ? `Your application for the ${application.requestedRole.replaceAll('_', ' ')} role was approved.`
                  : `Your application for the ${application.requestedRole.replaceAll('_', ' ')} role was rejected.`,
            },
          });

          return {
            id: application.id,
            requestedRole: application.requestedRole,
            status:
              decision === 'APPROVED'
                ? RoleApplicationStatus.APPROVED
                : RoleApplicationStatus.REJECTED,
            reviewedAt,
            applicantEmail: application.applicant.email,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'This role application changed while it was being reviewed.',
        );
      }
      throw error;
    }
  }
}
