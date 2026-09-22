import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { LoanVersionDto } from './dto/loan-version.dto';
import { MarkLostLoanDto } from './dto/mark-lost-loan.dto';
import { ReturnLoanDto } from './dto/return-loan.dto';
import { AdminLoanListQueryDto } from './dto/loan-list-query.dto';
import { LoansService } from './loans.service';

@ApiTags('loans-admin')
@Controller('admin/loans')
export class AdminLoansController {
  constructor(private readonly loansService: LoansService) {}

  @RequirePermissions('loans.read.any')
  @Get()
  @ApiOperation({ summary: 'List loans for circulation staff' })
  listAdminLoans(@Query() query: AdminLoanListQueryDto) {
    return this.loansService.listAdminLoans(query);
  }

  @RequirePermissions('loans.manage')
  @HttpCode(200)
  @Post(':id/checkout')
  @ApiOperation({ summary: 'Check out a reserved loan' })
  checkout(@Param('id') id: string, @Body() body: LoanVersionDto, @Req() req: RequestWithContext) {
    return this.loansService
      .checkoutLoan({
        loanId: id,
        actingUserId: req.actor!.userId,
        permissionCodes: req.actor!.permissionCodes,
        expectedVersion: body.version,
        requestId: req.requestId,
      })
      .then((data) => ({ data }));
  }

  @RequirePermissions('loans.manage')
  @HttpCode(200)
  @Post(':id/return')
  @ApiOperation({ summary: 'Return a borrowed loan' })
  returnLoan(@Param('id') id: string, @Body() body: ReturnLoanDto, @Req() req: RequestWithContext) {
    return this.loansService
      .returnLoan({
        loanId: id,
        actingUserId: req.actor!.userId,
        permissionCodes: req.actor!.permissionCodes,
        expectedVersion: body.version,
        conditionState: body.conditionState,
        requestId: req.requestId,
      })
      .then((data) => ({ data }));
  }

  @RequirePermissions('loans.manage')
  @HttpCode(200)
  @Post(':id/lost')
  @ApiOperation({ summary: 'Mark a borrowed loan as lost' })
  markLost(@Param('id') id: string, @Body() body: MarkLostLoanDto, @Req() req: RequestWithContext) {
    return this.loansService
      .markLostLoan({
        loanId: id,
        actingUserId: req.actor!.userId,
        permissionCodes: req.actor!.permissionCodes,
        expectedVersion: body.version,
        reason: body.reason,
        requestId: req.requestId,
      })
      .then((data) => ({ data }));
  }
}
