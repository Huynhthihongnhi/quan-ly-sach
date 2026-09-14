import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  DigitalAsset,
  DigitalAssetState,
  DigitalReadAccess,
} from './entities/digital-asset.entity';

export interface CreateDigitalAssetInput {
  bookId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  contentHash: Buffer;
  state: DigitalAssetState;
  readAccess: DigitalReadAccess;
  downloadRequiresCard: boolean;
  rightsNote: string;
  uploadedBy: string;
}

@Injectable()
export class DigitalAssetsRepository {
  constructor(
    @InjectRepository(DigitalAsset)
    private readonly assets: Repository<DigitalAsset>,
  ) {}

  findById(assetId: string): Promise<DigitalAsset | null> {
    return this.assets.findOne({ where: { id: assetId } });
  }

  async create(manager: EntityManager, input: CreateDigitalAssetInput): Promise<DigitalAsset> {
    const repository = manager.getRepository(DigitalAsset);
    const asset = repository.create({
      bookId: input.bookId,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      byteSize: String(input.byteSize),
      contentHash: input.contentHash,
      state: input.state,
      readAccess: input.readAccess,
      downloadRequiresCard: input.downloadRequiresCard,
      rightsNote: input.rightsNote,
      uploadedBy: input.uploadedBy,
    });
    return repository.save(asset);
  }

  async deleteById(manager: EntityManager, assetId: string): Promise<DigitalAsset | null> {
    const repository = manager.getRepository(DigitalAsset);
    const asset = await repository.findOne({ where: { id: assetId } });
    if (!asset) {
      return null;
    }
    await repository.delete({ id: assetId });
    return asset;
  }

  async listPublicReadyByBookIds(bookIds: string[]): Promise<Map<string, DigitalAsset[]>> {
    const grouped = new Map<string, DigitalAsset[]>();
    for (const bookId of bookIds) {
      grouped.set(bookId, []);
    }
    if (bookIds.length === 0) {
      return grouped;
    }

    const items = await this.assets.find({
      where: {
        bookId: In(bookIds),
        state: 'ready',
        readAccess: 'public',
      },
      order: { id: 'ASC' },
    });

    for (const asset of items) {
      const list = grouped.get(asset.bookId);
      if (list) {
        list.push(asset);
      }
    }

    return grouped;
  }

  async listReadyPublicForBook(bookId: string): Promise<DigitalAsset[]> {
    return this.assets.find({
      where: { bookId, state: 'ready', readAccess: 'public' },
      order: { id: 'ASC' },
    });
  }

  async findByIdForUpdate(manager: EntityManager, assetId: string): Promise<DigitalAsset | null> {
    return manager
      .getRepository(DigitalAsset)
      .createQueryBuilder('asset')
      .where('asset.id = :assetId', { assetId })
      .setLock('pessimistic_write')
      .getOne();
  }

  async updateAsset(
    manager: EntityManager,
    assetId: string,
    patch: Partial<
      Pick<DigitalAsset, 'state' | 'readAccess' | 'downloadRequiresCard' | 'rightsNote'>
    >,
  ): Promise<void> {
    await manager.getRepository(DigitalAsset).update({ id: assetId }, patch);
  }
}
