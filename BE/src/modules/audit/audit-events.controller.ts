import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';
import { AuditListQueryDto } from './dto/audit-list-query.dto';

@ApiTags('audit')
@Controller('audit-events')
export class AuditEventsController {
  constructor(private readonly auditService: AuditService) {}

  @RequirePermissions('audit.read')
  @Get()
  @ApiOperation({ summary: 'List audit events with optional filters' })
  listAuditEvents(@Query() query: AuditListQueryDto) {
    return this.auditService.listEvents(query);
  }
}
