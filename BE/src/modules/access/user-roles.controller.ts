import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { AccessService } from './access.service';
import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';

@ApiTags('user-roles')
@Controller('users')
export class UserRolesController {
  constructor(private readonly accessService: AccessService) {}

  @RequirePermissions('roles.read', 'users.read')
  @Get(':id/roles')
  @ApiOperation({ summary: 'List roles assigned to a user' })
  getUserRoles(@Param('id') id: string) {
    return this.accessService.getUserRoles(id);
  }

  @RequirePermissions('users.roles.write')
  @Put(':id/roles')
  @ApiOperation({ summary: 'Replace roles assigned to a user' })
  replaceUserRoles(
    @Param('id') id: string,
    @Body() body: ReplaceUserRolesDto,
    @Req() req: RequestWithContext,
  ) {
    return this.accessService.replaceUserRoles(id, body, req.actor!.userId, req.requestId);
  }
}
