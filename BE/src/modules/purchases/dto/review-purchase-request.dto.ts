import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export type PurchaseReviewDecision = 'approved' | 'rejected';

export class ReviewPurchaseRequestDto {
  @IsIn(['approved', 'rejected'])
  decision!: PurchaseReviewDecision;

  @ValidateIf((body: ReviewPurchaseRequestDto) => body.decision === 'rejected')
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason?: string;

  @IsString()
  @MinLength(1)
  version!: string;
}
