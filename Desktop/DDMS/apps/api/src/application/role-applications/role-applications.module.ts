import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoleApplicationsRepository } from '../../persistence/role-applications.repository.js';
import { RoleApplicationsController } from './role-applications.controller.js';
import { RoleApplicationsService } from './role-applications.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RoleApplicationsController],
  providers: [RoleApplicationsRepository, RoleApplicationsService],
})
export class RoleApplicationsModule {}
