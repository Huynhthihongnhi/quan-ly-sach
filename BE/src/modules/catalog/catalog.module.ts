import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CirculationModule } from '../circulation/circulation.module';
import { DigitalModule } from '../digital/digital.module';
import { AdminBooksController } from './admin-books.controller';
import { AdminCopiesController } from './admin-copies.controller';
import { AdminTaxonomyController } from './admin-taxonomy.controller';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogPublicRepository } from './catalog-public.repository';
import { CatalogPublicService } from './catalog-public.service';
import { CatalogRepository } from './catalog.repository';
import { PublicBooksController } from './public-books.controller';
import { PublicTaxonomyController } from './public-taxonomy.controller';
import { Author } from './entities/author.entity';
import { BookAuthor } from './entities/book-author.entity';
import { BookCopy } from './entities/book-copy.entity';
import { BookTopic } from './entities/book-topic.entity';
import { Book } from './entities/book.entity';
import { Category } from './entities/category.entity';
import { Topic } from './entities/topic.entity';

@Module({
  imports: [
    AuditModule,
    CirculationModule,
    forwardRef(() => DigitalModule),
    TypeOrmModule.forFeature([Category, Author, Topic, Book, BookAuthor, BookTopic, BookCopy]),
  ],
  controllers: [
    AdminBooksController,
    AdminTaxonomyController,
    AdminCopiesController,
    PublicBooksController,
    PublicTaxonomyController,
  ],
  providers: [
    CatalogRepository,
    CatalogAdminService,
    CatalogPublicRepository,
    CatalogPublicService,
  ],
  exports: [CatalogRepository, CatalogAdminService, CatalogPublicService, TypeOrmModule],
})
export class CatalogModule {}
