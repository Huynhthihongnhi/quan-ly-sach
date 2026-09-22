import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { OwnLoanListQueryDto } from './dto/loan-list-query.dto';
import { LoansService } from './loans.service';

@ApiTags('me')
@Controller('me/loans')
export class MeLoansController {
  constructor(private readonly loansService: LoansService) {}

  @RequirePermissions('loans.read.own')
  @Get()
  @ApiOperation({ summary: 'List loans for the signed-in user' })
  listOwnLoans(@Req() req: RequestWithContext, @Query() query: OwnLoanListQueryDto) {
    return this.loansService.listOwnLoans(req.actor!.userId, query);
  }
}
