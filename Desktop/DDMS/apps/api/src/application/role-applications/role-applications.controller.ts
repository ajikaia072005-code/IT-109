import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { SubmitRoleApplicationDto } from './role-applications.dto.js';
import { RoleApplicationsService } from './role-applications.service.js';

@Controller('role-applications')
@UseGuards(AuthGuard, PermissionsGuard)
export class RoleApplicationsController {
  constructor(private readonly applications: RoleApplicationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('role_applications.submit')
  submit(
    @Req() request: AuthenticatedRequest,
    @Body() input: SubmitRoleApplicationDto,
  ) {
    return this.applications.submit(
      request.user!.id,
      input.requestedRole,
      input.reason,
    );
  }

  @Get()
  listForApplicant(@Req() request: AuthenticatedRequest) {
    return this.applications.listForApplicant(request.user!.id);
  }

  @Get('pending')
  @RequirePermissions('role_applications.review')
  listPending() {
    return this.applications.listPending();
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('role_applications.review')
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id') applicationId: string,
  ) {
    return this.applications.review(
      applicationId,
      request.user!.id,
      'APPROVED',
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('role_applications.review')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') applicationId: string,
  ) {
    return this.applications.review(
      applicationId,
      request.user!.id,
      'REJECTED',
    );
  }
}
