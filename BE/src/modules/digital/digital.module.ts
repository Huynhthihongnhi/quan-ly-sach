import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CardsModule } from '../cards/cards.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminBookDigitalAssetsController } from './admin-book-digital-assets.controller';
import { AdminDigitalAssetsController } from './admin-digital-assets.controller';
import { DigitalContentController } from './digital-content.controller';
import { DigitalAssetsRepository } from './digital-assets.repository';
import { DigitalAssetsService } from './digital-assets.service';
import { DIGITAL_FILE_STORAGE } from './digital-storage.tokens';
import { DigitalAsset } from './entities/digital-asset.entity';
import { LocalDigitalFileStorage } from './local-digital-file-storage';

const storageRoot =
  process.env.DIGITAL_STORAGE_ROOT ?? join(tmpdir(), 'quan-ly-sach-digital-storage');

@Module({
  imports: [TypeOrmModule.forFeature([DigitalAsset]), CardsModule, forwardRef(() => CatalogModule)],
  controllers: [
    AdminBookDigitalAssetsController,
    AdminDigitalAssetsController,
    DigitalContentController,
  ],
  providers: [
    DigitalAssetsRepository,
    DigitalAssetsService,
    {
      provide: DIGITAL_FILE_STORAGE,
      useFactory: () => new LocalDigitalFileStorage(storageRoot),
    },
  ],
  exports: [DigitalAssetsService, DigitalAssetsRepository, TypeOrmModule],
})
export class DigitalModule {}
