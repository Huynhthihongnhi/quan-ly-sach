import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminLibraryCardsController } from './admin-library-cards.controller';
import { CardsRepository } from './cards.repository';
import { CardsService } from './cards.service';
import { LibraryCard } from './entities/library-card.entity';
import { MeLibraryCardsController } from './me-library-cards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LibraryCard]), AuditModule, IdentityModule],
  controllers: [MeLibraryCardsController, AdminLibraryCardsController],
  providers: [CardsRepository, CardsService],
  exports: [CardsService, CardsRepository, TypeOrmModule],
})
export class CardsModule {}
