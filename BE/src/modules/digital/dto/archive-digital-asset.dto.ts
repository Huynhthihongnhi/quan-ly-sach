import { IsIn } from 'class-validator';
import type { DigitalAssetState } from '../entities/digital-asset.entity';

export class ArchiveDigitalAssetDto {
  @IsIn(['quarantine', 'ready', 'rejected', 'archived'])
  expectedState!: DigitalAssetState;
}
