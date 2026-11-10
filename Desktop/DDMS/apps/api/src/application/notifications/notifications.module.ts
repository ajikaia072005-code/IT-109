import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsRepository } from '../../persistence/notifications.repository.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
