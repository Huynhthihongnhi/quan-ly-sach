import { DigitalAsset } from '../entities/digital-asset.entity';

export interface PublicDigitalAssetResponse {
  id: string;
  mimeType: string;
  byteSize: number;
  readAccess: DigitalAsset['readAccess'];
  downloadRequiresCard: boolean;
  rightsNote: string;
}

export function toPublicDigitalAssetResponse(asset: DigitalAsset): PublicDigitalAssetResponse {
  return {
    id: asset.id,
    mimeType: asset.mimeType,
    byteSize: Number(asset.byteSize),
    readAccess: asset.readAccess,
    downloadRequiresCard: asset.downloadRequiresCard,
    rightsNote: asset.rightsNote,
  };
}
