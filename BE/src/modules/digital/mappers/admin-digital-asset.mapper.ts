import { DigitalAsset } from '../entities/digital-asset.entity';

export interface AdminDigitalAssetResponse {
  id: string;
  bookId: string;
  mimeType: string;
  byteSize: number;
  state: DigitalAsset['state'];
  readAccess: DigitalAsset['readAccess'];
  downloadRequiresCard: boolean;
  rightsNote: string;
  uploadedBy: string;
  createdAt: string;
}

export function toAdminDigitalAssetResponse(asset: DigitalAsset): AdminDigitalAssetResponse {
  return {
    id: asset.id,
    bookId: asset.bookId,
    mimeType: asset.mimeType,
    byteSize: Number(asset.byteSize),
    state: asset.state,
    readAccess: asset.readAccess,
    downloadRequiresCard: asset.downloadRequiresCard,
    rightsNote: asset.rightsNote,
    uploadedBy: asset.uploadedBy,
    createdAt: asset.createdAt.toISOString(),
  };
}
