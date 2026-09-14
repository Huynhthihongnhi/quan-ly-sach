import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiException } from '../../common/http/api.exception';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { ErrorCode } from '../../common/http/error-code';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoansService } from './loans.service';

const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{1,64}$/;

@ApiTags('loans')
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @RequirePermissions('loans.create.own')
  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Reserve a copy for borrowing' })
  async createLoan(
    @Body() body: CreateLoanDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new ApiException(
        422,
        ErrorCode.VALIDATION_FAILED,
        'Idempotency-Key must be 1 to 64 ASCII characters.',
        [{ field: 'Idempotency-Key', code: 'INVALID_FORMAT' }],
      );
    }

    const result = await this.loansService.createReservation({
      actingUserId: req.actor!.userId,
      body,
      idempotencyKey: key,
      requestId: req.requestId,
    });

    if (result.replay) {
      res.status(200);
    } else {
      res.status(201);
      res.setHeader('Location', `/api/v1/loans/${result.data.id}`);
    }

    return { data: result.data };
  }
}
