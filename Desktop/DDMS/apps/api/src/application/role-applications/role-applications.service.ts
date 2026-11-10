import { BadRequestException, Injectable } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { RoleApplicationsRepository } from '../../persistence/role-applications.repository.js';

@Injectable()
export class RoleApplicationsService {
  constructor(private readonly repository: RoleApplicationsRepository) {}

  listForApplicant(userId: string) {
    return this.repository.listForApplicant(userId);
  }

  listPending() {
    return this.repository.listPending();
  }

  async submit(userId: string, requestedRole: RoleName, reason: string) {
    if (requestedRole === RoleName.VIEWER_STUDENT) {
      throw new BadRequestException(
        'The Viewer role is the default role and cannot be requested.',
      );
    }
    if (!reason.trim()) {
      throw new BadRequestException('A reason is required.');
    }

    return this.repository.submit(userId, requestedRole, reason);
  }

  async review(
    applicationId: string,
    reviewerId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    const result = await this.repository.review(
      applicationId,
      reviewerId,
      decision,
    );
    return {
      id: result.id,
      requestedRole: result.requestedRole,
      status: result.status,
      reviewedAt: result.reviewedAt,
    };
  }
}
