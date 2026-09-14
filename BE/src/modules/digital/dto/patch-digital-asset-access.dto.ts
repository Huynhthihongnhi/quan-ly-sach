import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { DigitalAssetState, DigitalReadAccess } from '../entities/digital-asset.entity';

export class PatchDigitalAssetAccessDto {
  @IsOptional()
  @IsIn(['public', 'authenticated', 'card'])
  readAccess?: DigitalReadAccess;

  @IsOptional()
  @IsBoolean()
  downloadRequiresCard?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rightsNote?: string;

  @IsIn(['quarantine', 'ready', 'rejected', 'archived'])
  state!: DigitalAssetState;

  @IsIn(['quarantine', 'ready', 'rejected', 'archived'])
  expectedState!: DigitalAssetState;
}
