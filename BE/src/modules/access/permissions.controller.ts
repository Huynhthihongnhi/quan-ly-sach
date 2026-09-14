import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/http/dto/pagination-query.dto';
import { AccessService } from './access.service';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly accessService: AccessService) {}

  @RequirePermissions('permissions.read')
  @Get()
  @ApiOperation({ summary: 'List permission registry entries' })
  listPermissions(@Query() query: PaginationQueryDto) {
    return this.accessService.listPermissions(query);
  }
}
