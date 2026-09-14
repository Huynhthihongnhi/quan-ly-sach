import { IsIn, IsString } from 'class-validator';
import type { LibraryCardState } from '../entities/library-card.entity';

export class UpdateLibraryCardStateDto {
  @IsIn(['active', 'suspended', 'revoked', 'expired'])
  state!: LibraryCardState;

  @IsString()
  @IsIn(['active', 'suspended', 'revoked', 'expired'])
  expectedState!: LibraryCardState;
}
