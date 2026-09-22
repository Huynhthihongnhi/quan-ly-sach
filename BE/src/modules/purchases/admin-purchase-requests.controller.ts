import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { AdminPurchaseListQueryDto } from './dto/purchase-list-query.dto';
import { ReviewPurchaseRequestDto } from './dto/review-purchase-request.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('purchase-requests-admin')
@Controller('admin/purchase-requests')
export class AdminPurchaseRequestsController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @RequirePermissions('purchases.read.any')
  @Get()
  @ApiOperation({ summary: 'List purchase requests for reviewers' })
  list(@Query() query: AdminPurchaseListQueryDto) {
    return this.purchasesService.listAdminRequests(query);
  }

  @RequirePermissions('purchases.review')
  @HttpCode(200)
  @Post(':id/review')
  @ApiOperation({ summary: 'Approve or reject a pending purchase request' })
  review(
    @Param('id') id: string,
    @Body() body: ReviewPurchaseRequestDto,
    @Req() req: RequestWithContext,
  ) {
    return this.purchasesService
      .reviewRequest({
        purchaseRequestId: id,
        reviewerId: req.actor!.userId,
        body,
        requestId: req.requestId,
      })
      .then((data) => ({ data }));
  }
}
