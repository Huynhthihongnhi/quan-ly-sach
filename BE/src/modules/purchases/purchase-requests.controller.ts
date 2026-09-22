import { Body, Controller, Get, Headers, Param, Post, Req, Res } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiException } from '../../common/http/api.exception';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { ErrorCode } from '../../common/http/error-code';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { PurchasesService } from './purchases.service';

const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{1,64}$/;

@ApiTags('purchase-requests')
@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @RequirePermissions('purchases.create.own')
  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Submit a purchase request' })
  async create(
    @Body() body: CreatePurchaseRequestDto,
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

    const result = await this.purchasesService.createRequest({
      requesterId: req.actor!.userId,
      body,
      idempotencyKey: key,
      requestId: req.requestId,
    });

    if (result.replay) {
      res.status(200);
    } else {
      res.status(201);
      res.setHeader('Location', `/api/v1/purchase-requests/${result.data.id}`);
    }
    return { data: result.data };
  }

  @RequirePermissions('purchases.read.own')
  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase request with event history' })
  getById(@Param('id') id: string, @Req() req: RequestWithContext) {
    return this.purchasesService
      .getRequestDetail({
        purchaseRequestId: id,
        actingUserId: req.actor!.userId,
        permissionCodes: req.actor!.permissionCodes,
      })
      .then((data) => ({ data }));
  }
}
