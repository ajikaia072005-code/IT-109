import { BadRequestException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { RoleApplicationsRepository } from '../../persistence/role-applications.repository.js';
import { RoleApplicationsService } from './role-applications.service.js';

describe('RoleApplicationsService', () => {
  let service: RoleApplicationsService;
  let repository: {
    submit: ReturnType<typeof vi.fn>;
    listForApplicant: ReturnType<typeof vi.fn>;
    listPending: ReturnType<typeof vi.fn>;
    review: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    repository = {
      submit: vi.fn().mockResolvedValue({
        id: 'application-1',
        status: 'PENDING',
      }),
      listForApplicant: vi.fn(),
      listPending: vi.fn(),
      review: vi.fn().mockResolvedValue({
        id: 'application-1',
        requestedRole: RoleName.FACULTY,
        status: 'APPROVED',
        reviewedAt: new Date(),
        applicantEmail: 'applicant@gmail.com',
      }),
    };
    service = new RoleApplicationsService(
      repository as unknown as RoleApplicationsRepository,
    );
  });

  it('does not allow requesting the default Viewer role', async () => {
    await expect(
      service.submit(
        'viewer-1',
        RoleName.VIEWER_STUDENT,
        'Please assign me the viewer role.',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it('requires a non-blank reason before persisting an application', async () => {
    await expect(
      service.submit('viewer-1', RoleName.FACULTY, '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it('persists the role application', async () => {
    await service.submit(
      'viewer-1',
      RoleName.FACULTY,
      'I teach in the department.',
    );

    expect(repository.submit).toHaveBeenCalledWith(
      'viewer-1',
      RoleName.FACULTY,
      'I teach in the department.',
    );
  });

  it('persists review decisions and omits the applicant email', async () => {
    const result = await service.review('application-1', 'admin-1', 'APPROVED');

    expect(repository.review).toHaveBeenCalledWith(
      'application-1',
      'admin-1',
      'APPROVED',
    );
    expect(result).not.toHaveProperty('applicantEmail');
  });
});
