import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PurchaseRequestEvent } from './entities/purchase-request-event.entity';
import { PurchaseRequest } from './entities/purchase-request.entity';
import { AdminPurchaseRequestsController } from './admin-purchase-requests.controller';
import { MePurchaseRequestsController } from './me-purchase-requests.controller';
import { PurchaseRequestsController } from './purchase-requests.controller';
import { PurchasesRepository } from './purchases.repository';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [AuditModule, TypeOrmModule.forFeature([PurchaseRequest, PurchaseRequestEvent])],
  controllers: [
    PurchaseRequestsController,
    MePurchaseRequestsController,
    AdminPurchaseRequestsController,
  ],
  providers: [PurchasesRepository, PurchasesService],
  exports: [PurchasesService, PurchasesRepository, TypeOrmModule],
})
export class PurchasesModule {}
