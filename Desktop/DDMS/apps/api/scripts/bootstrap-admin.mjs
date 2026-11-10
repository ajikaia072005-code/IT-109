import { Prisma, PrismaClient, RoleName, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function bootstrapAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error('Set ADMIN_BOOTSTRAP_EMAIL to the verified account to promote.');
  }

  await prisma.$transaction(
    async (transaction) => {
      const adminRole = await transaction.role.findUnique({
        where: { name: RoleName.SYSTEM_ADMIN },
        select: { id: true },
      });
      if (!adminRole) {
        throw new Error('Run the role seed before bootstrapping the first admin.');
      }

      const existingAdmin = await transaction.userRole.findFirst({
        where: { roleId: adminRole.id },
        select: { userId: true },
      });
      if (existingAdmin) {
        throw new Error('A System Admin is already assigned; bootstrap is one-time.');
      }

      const user = await transaction.user.findUnique({
        where: { email },
        select: { id: true, status: true, emailVerifiedAt: true },
      });
      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        !user.emailVerifiedAt
      ) {
        throw new Error('The configured admin account must exist and be email-verified.');
      }

      await transaction.userRole.upsert({
        where: { userId: user.id },
        update: { roleId: adminRole.id },
        create: { userId: user.id, roleId: adminRole.id },
      });

      await transaction.auditLog.create({
        data: {
          action: 'SYSTEM_ADMIN_BOOTSTRAPPED',
          targetType: 'USER',
          targetId: user.id,
          metadata: { email },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

bootstrapAdmin()
  .then(() => {
    console.log('The verified account was assigned the System Admin role.');
  })
  .catch((error) => {
    console.error('System Admin bootstrap failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
