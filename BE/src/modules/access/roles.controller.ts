import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiException } from '../../common/http/api.exception';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { SkipResponseEnvelope } from '../../common/http/decorators/skip-response-envelope.decorator';
import { PaginationQueryDto } from '../../common/http/dto/pagination-query.dto';
import { ErrorCode } from '../../common/http/error-code';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { AccessService } from './access.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { ReplaceRolePermissionsDto } from './dto/replace-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly accessService: AccessService) {}

  @RequirePermissions('roles.read')
  @Get()
  @ApiOperation({ summary: 'List roles with pagination' })
  listRoles(@Query() query: PaginationQueryDto) {
    return this.accessService.listRoles(query);
  }

  @RequirePermissions('roles.write')
  @Post()
  @ApiOperation({ summary: 'Create a non-system role' })
  async createRole(
    @Body() body: CreateRoleDto,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const role = await this.accessService.createRole(body, req.actor!.userId, req.requestId);
    res.status(201);
    res.setHeader('Location', `/api/v1/roles/${role.id}`);
    return role;
  }

  @RequirePermissions('roles.write')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a non-system role' })
  updateRole(@Param('id') id: string, @Body() body: UpdateRoleDto, @Req() req: RequestWithContext) {
    return this.accessService.updateRole(id, body, req.actor!.userId, req.requestId);
  }

  @RequirePermissions('roles.write')
  @SkipResponseEnvelope()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a non-system role' })
  async deleteRole(
    @Param('id') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!ifMatch) {
      throw new ApiException(400, ErrorCode.VALIDATION_FAILED, 'If-Match header is required.');
    }

    await this.accessService.deleteRole(id, ifMatch, req.actor!.userId, req.requestId);
    res.status(204);
  }

  @RequirePermissions('roles.write')
  @Put(':id/permissions')
  @ApiOperation({ summary: 'Replace permissions assigned to a role' })
  replaceRolePermissions(
    @Param('id') id: string,
    @Body() body: ReplaceRolePermissionsDto,
    @Req() req: RequestWithContext,
  ) {
    return this.accessService.replaceRolePermissions(id, body, req.actor!.userId, req.requestId);
  }
}
