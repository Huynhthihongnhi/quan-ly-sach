import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CardsModule } from '../cards/cards.module';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { CirculationConfigService } from './circulation-config.service';
import { CirculationInventoryService } from './circulation-inventory.service';
import { LoanEvent } from './entities/loan-event.entity';
import { Loan } from './entities/loan.entity';
import { LoansController } from './loans.controller';
import { LoansRepository } from './loans.repository';
import { LoansService } from './loans.service';

@Module({
  imports: [
    AppConfigModule,
    AuthModule,
    AuditModule,
    IdentityModule,
    CardsModule,
    forwardRef(() => CatalogModule),
    TypeOrmModule.forFeature([Loan, LoanEvent]),
  ],
  controllers: [LoansController],
  providers: [CirculationConfigService, CirculationInventoryService, LoansRepository, LoansService],
  exports: [CirculationInventoryService, CirculationConfigService, TypeOrmModule],
})
export class CirculationModule {}
