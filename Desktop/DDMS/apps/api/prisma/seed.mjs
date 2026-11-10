import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

const rolePermissions = {
  SYSTEM_ADMIN: [
    'users.manage',
    'roles.manage',
    'system.manage',
    'audit.read',
    'archives.manage',
    'role_applications.review',
  ],
  DEPARTMENT_HEAD: [
    'documents.view_department',
    'documents.review_department',
    'documents.approve_department',
  ],
  FACULTY: [
    'documents.upload',
    'documents.submit',
    'documents.view_authorized',
    'documents.track_own',
  ],
  STAFF: [
    'documents.upload',
    'documents.submit',
    'documents.view_authorized',
    'documents.track_own',
  ],
  ORGANIZATION: ['documents.upload', 'documents.submit'],
  VIEWER_STUDENT: [
    'documents.search',
    'documents.view_authorized',
    'documents.download_authorized',
    'role_applications.submit',
  ],
};

const permissionDescriptions = {
  'users.manage': 'Manage user accounts.',
  'roles.manage': 'Manage roles and permission assignments.',
  'system.manage': 'Manage system configuration.',
  'audit.read': 'Access audit logs.',
  'archives.manage': 'Manage system archives.',
  'role_applications.review': 'Review and decide role applications.',
  'documents.view_department': 'View authorized department documents.',
  'documents.review_department': 'Review authorized department documents.',
  'documents.approve_department': 'Approve or reject department documents.',
  'documents.upload': 'Upload documents.',
  'documents.submit': 'Submit documents.',
  'documents.view_authorized': 'View documents the user is authorized to access.',
  'documents.track_own': 'Track the status of the user’s submissions.',
  'documents.search': 'Search documents the user is authorized to discover.',
  'documents.download_authorized': 'Download documents the user is authorized to access.',
  'role_applications.submit': 'Submit a role application as a Viewer.',
};

const roles = [
  [RoleName.SYSTEM_ADMIN, 'System Admin'],
  [RoleName.DEPARTMENT_HEAD, 'Department Head'],
  [RoleName.FACULTY, 'Faculty'],
  [RoleName.STAFF, 'Staff'],
  [RoleName.ORGANIZATION, 'Organization'],
  [RoleName.VIEWER_STUDENT, 'Viewer / Student'],
];

async function seed() {
  const permissions = new Map();
  for (const [key, description] of Object.entries(permissionDescriptions)) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissions.set(key, permission.id);
  }

  for (const [name, description] of roles) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const keys = rolePermissions[name];
    if (keys.length > 0) {
      await prisma.rolePermission.createMany({
        data: keys.map((key) => ({
          roleId: role.id,
          permissionId: permissions.get(key),
        })),
      });
    }
  }
}

seed()
  .catch((error) => {
    console.error('Failed to seed DDMS roles and permissions.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
