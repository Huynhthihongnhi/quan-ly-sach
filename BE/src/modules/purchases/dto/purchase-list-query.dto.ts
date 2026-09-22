import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/dto/pagination-query.dto';
import type { PurchaseRequestState } from '../entities/purchase-request.entity';

export class OwnPurchaseListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  state?: PurchaseRequestState;
}

export class AdminPurchaseListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  state?: PurchaseRequestState;
}
