import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.notifications.listForUser(
      request.user!.id,
      Math.min(Math.max(limit, 1), 100),
    );
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id') notificationId: string,
  ) {
    await this.notifications.markRead(request.user!.id, notificationId);
  }

  @Post('read-all')
  async markAllRead(@Req() request: AuthenticatedRequest) {
    const updated = await this.notifications.markAllRead(request.user!.id);
    return { updated };
  }
}
