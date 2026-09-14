import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { CatalogRepository } from '../catalog/catalog.repository';
import { CardsService } from '../cards/cards.service';
import { isAllowedDigitalAssetStateTransition } from './digital-asset-state';
import { DIGITAL_ASSET_MAX_BYTE_SIZE } from './digital.constants';
import type { DigitalContentSlice } from './digital-content.types';
import type { DigitalFileStorage } from './digital-file-storage.interface';
import { DigitalAssetsRepository, CreateDigitalAssetInput } from './digital-assets.repository';
import { DIGITAL_FILE_STORAGE } from './digital-storage.tokens';
import { PatchDigitalAssetAccessDto } from './dto/patch-digital-asset-access.dto';
import { DigitalAsset, DigitalReadAccess } from './entities/digital-asset.entity';
import { parseSingleByteRange, RangeParseError } from './http-range.util';
import {
  AdminDigitalAssetResponse,
  toAdminDigitalAssetResponse,
} from './mappers/admin-digital-asset.mapper';
import {
  PublicDigitalAssetResponse,
  toPublicDigitalAssetResponse,
} from './mappers/public-digital-asset.mapper';
import { validatePdfUpload } from './pdf-file.validator';
import { buildDigitalAssetStorageKey } from './storage-key.util';

@Injectable()
export class DigitalAssetsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly digitalAssetsRepository: DigitalAssetsRepository,
    private readonly catalogRepository: CatalogRepository,
    private readonly cardsService: CardsService,
    @Inject(DIGITAL_FILE_STORAGE) private readonly fileStorage: DigitalFileStorage,
  ) {}

  listPublicMetadataForBook(bookId: string): Promise<PublicDigitalAssetResponse[]> {
    return this.digitalAssetsRepository
      .listReadyPublicForBook(bookId)
      .then((assets) => assets.map(toPublicDigitalAssetResponse));
  }

  async uploadPdfForBook(params: {
    bookId: string;
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string };
    rightsNote: string;
    uploadedBy: string;
  }): Promise<AdminDigitalAssetResponse> {
    const book = await this.catalogRepository.findBookById(params.bookId);
    if (!book) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }

    const originalName = params.file.originalname ?? '';
    if (originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
      throw new ApiException(422, ErrorCode.VALIDATION_FAILED, 'File name is not allowed.');
    }

    let validated: { mimeType: string; byteSize: number };
    try {
      validated = validatePdfUpload(params.file);
    } catch (error) {
      throw mapPdfValidationError(error);
    }

    if (validated.byteSize > DIGITAL_ASSET_MAX_BYTE_SIZE) {
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        ErrorCode.VALIDATION_FAILED,
        'File exceeds the allowed size limit.',
      );
    }

    const storageKey = buildDigitalAssetStorageKey(params.bookId);
    const contentHash = createHash('sha256').update(params.file.buffer).digest();
    const input: CreateDigitalAssetInput = {
      bookId: params.bookId,
      storageKey,
      mimeType: validated.mimeType,
      byteSize: validated.byteSize,
      contentHash,
      state: 'quarantine',
      readAccess: 'authenticated',
      downloadRequiresCard: true,
      rightsNote: params.rightsNote.trim(),
      uploadedBy: params.uploadedBy,
    };

    const created = await this.registerMetadata(input, params.file.buffer);
    return toAdminDigitalAssetResponse(created);
  }

  async patchAccess(
    assetId: string,
    body: PatchDigitalAssetAccessDto,
  ): Promise<AdminDigitalAssetResponse> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const asset = await this.digitalAssetsRepository.findByIdForUpdate(manager, assetId);
      if (!asset) {
        throw new ApiException(404, ErrorCode.NOT_FOUND, 'Digital asset was not found.');
      }
      if (asset.state !== body.expectedState) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Digital asset state has changed.');
      }
      if (!isAllowedDigitalAssetStateTransition(asset.state, body.state)) {
        throw new ApiException(
          409,
          ErrorCode.INVALID_TRANSITION,
          'Digital asset state transition is not allowed.',
        );
      }

      const patch: Partial<
        Pick<DigitalAsset, 'state' | 'readAccess' | 'downloadRequiresCard' | 'rightsNote'>
      > = { state: body.state };
      if (body.readAccess !== undefined) {
        patch.readAccess = body.readAccess;
      }
      if (body.downloadRequiresCard !== undefined) {
        patch.downloadRequiresCard = body.downloadRequiresCard;
      }
      if (body.rightsNote !== undefined) {
        patch.rightsNote = body.rightsNote.trim();
      }

      await this.digitalAssetsRepository.updateAsset(manager, assetId, patch);
      return this.digitalAssetsRepository.findByIdForUpdate(manager, assetId);
    });

    if (!updated) {
      throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Digital asset update failed.');
    }
    return toAdminDigitalAssetResponse(updated);
  }

  async archiveAsset(
    assetId: string,
    expectedState: DigitalAsset['state'],
  ): Promise<AdminDigitalAssetResponse> {
    return this.patchAccess(assetId, {
      expectedState,
      state: 'archived',
    });
  }

  async openContentForRead(params: {
    assetId: string;
    actorUserId: string | null;
    rangeHeader?: string;
  }): Promise<DigitalContentSlice> {
    const asset = await this.loadDeliverableAsset(params.assetId);
    await this.assertReadPolicy(asset, params.actorUserId);
    return this.sliceContent(asset, params.rangeHeader, 'inline');
  }

  async openContentForDownload(params: {
    assetId: string;
    actorUserId: string;
  }): Promise<DigitalContentSlice> {
    const asset = await this.loadDeliverableAsset(params.assetId);
    await this.assertReadPolicy(asset, params.actorUserId);
    if (asset.downloadRequiresCard) {
      await this.cardsService.assertActiveCardForUser(params.actorUserId);
    }
    return this.sliceContent(asset, undefined, 'attachment');
  }

  async registerMetadata(
    input: CreateDigitalAssetInput,
    fileContent: Buffer,
  ): Promise<DigitalAsset> {
    assertSafeStorageKey(input.storageKey);

    if (input.byteSize <= 0 || fileContent.length !== input.byteSize) {
      throw new ApiException(422, ErrorCode.VALIDATION_FAILED, 'byteSize must match file content.');
    }
    if (input.byteSize > DIGITAL_ASSET_MAX_BYTE_SIZE) {
      throw new ApiException(
        422,
        ErrorCode.VALIDATION_FAILED,
        'File exceeds the allowed size limit.',
      );
    }

    await this.fileStorage.putObject(input.storageKey, fileContent);

    try {
      return await this.dataSource.transaction((manager) =>
        this.digitalAssetsRepository.create(manager, input),
      );
    } catch (error) {
      await this.fileStorage.deleteObject(input.storageKey);
      throw error;
    }
  }

  async deleteMetadata(assetId: string): Promise<void> {
    const removed = await this.dataSource.transaction((manager) =>
      this.digitalAssetsRepository.deleteById(manager, assetId),
    );
    if (!removed) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Digital asset was not found.');
    }
    await this.fileStorage.deleteObject(removed.storageKey);
  }

  async assertReadyForContentDelivery(assetId: string): Promise<DigitalAsset> {
    const asset = await this.digitalAssetsRepository.findById(assetId);
    if (!asset) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Digital asset was not found.');
    }
    if (asset.state !== 'ready') {
      throw new ApiException(409, ErrorCode.INVALID_TRANSITION, 'Digital asset is not ready.');
    }
    return asset;
  }

  private async loadDeliverableAsset(assetId: string): Promise<DigitalAsset> {
    const asset = await this.digitalAssetsRepository.findById(assetId);
    if (!asset) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Digital asset was not found.');
    }
    if (asset.state !== 'ready') {
      throw new ApiException(409, ErrorCode.INVALID_TRANSITION, 'Digital asset is not ready.');
    }

    const book = await this.catalogRepository.findBookById(asset.bookId);
    if (!book || book.state !== 'published') {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Digital asset was not found.');
    }

    return asset;
  }

  private async assertReadPolicy(asset: DigitalAsset, actorUserId: string | null): Promise<void> {
    await this.assertReadAccessLevel(asset.readAccess, actorUserId);
  }

  private async assertReadAccessLevel(
    readAccess: DigitalReadAccess,
    actorUserId: string | null,
  ): Promise<void> {
    if (readAccess === 'public') {
      return;
    }
    if (!actorUserId) {
      throw new ApiException(401, ErrorCode.AUTHENTICATION_REQUIRED, 'Authentication is required.');
    }
    if (readAccess === 'authenticated') {
      return;
    }
    await this.cardsService.assertActiveCardForUser(actorUserId);
  }

  private async sliceContent(
    asset: DigitalAsset,
    rangeHeader: string | undefined,
    _disposition: 'inline' | 'attachment',
  ): Promise<DigitalContentSlice> {
    let buffer: Buffer;
    try {
      buffer = await this.fileStorage.readObject(asset.storageKey);
    } catch {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Digital asset was not found.');
    }

    const totalSize = buffer.length;
    const filename = `asset-${asset.id}.pdf`;

    let range: ReturnType<typeof parseSingleByteRange> = null;
    try {
      range = parseSingleByteRange(rangeHeader, totalSize);
    } catch (error) {
      if (error instanceof RangeParseError) {
        throw new ApiException(
          HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
          ErrorCode.VALIDATION_FAILED,
          error.message,
        );
      }
      throw error;
    }

    if (!range) {
      return {
        body: buffer,
        mimeType: asset.mimeType,
        filename,
        totalSize,
        statusCode: 200,
      };
    }

    const slice = buffer.subarray(range.start, range.end + 1);
    return {
      body: slice,
      mimeType: asset.mimeType,
      filename,
      totalSize,
      statusCode: 206,
      contentRange: `bytes ${range.start}-${range.end}/${totalSize}`,
    };
  }
}

function assertSafeStorageKey(storageKey: string): void {
  if (!storageKey.startsWith('assets/') || storageKey.includes('..') || storageKey.includes('\\')) {
    throw new ApiException(422, ErrorCode.VALIDATION_FAILED, 'Storage key is not allowed.');
  }
}

function mapPdfValidationError(error: unknown): ApiException {
  if (!(error instanceof Error)) {
    return new ApiException(415, ErrorCode.VALIDATION_FAILED, 'File type is not supported.');
  }
  switch (error.message) {
    case 'EMPTY_FILE':
      return new ApiException(422, ErrorCode.VALIDATION_FAILED, 'Uploaded file is empty.');
    case 'INVALID_PDF':
    case 'INVALID_MIME':
      return new ApiException(415, ErrorCode.VALIDATION_FAILED, 'Only PDF uploads are supported.');
    default:
      return new ApiException(415, ErrorCode.VALIDATION_FAILED, 'File type is not supported.');
  }
}
