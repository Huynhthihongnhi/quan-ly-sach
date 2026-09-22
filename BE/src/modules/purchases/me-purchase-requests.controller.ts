import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { OwnPurchaseListQueryDto } from './dto/purchase-list-query.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('me')
@Controller('me/purchase-requests')
export class MePurchaseRequestsController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @RequirePermissions('purchases.read.own')
  @Get()
  @ApiOperation({ summary: 'List purchase requests for the signed-in user' })
  listOwn(@Req() req: RequestWithContext, @Query() query: OwnPurchaseListQueryDto) {
    return this.purchasesService.listOwnRequests(req.actor!.userId, query);
  }
}
