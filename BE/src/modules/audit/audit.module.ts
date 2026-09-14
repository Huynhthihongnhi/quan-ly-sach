import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventsController } from './audit-events.controller';
import { AuditRepository } from './audit.repository';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditEventsController],
  providers: [AuditRepository, AuditService],
  exports: [AuditService, AuditRepository, TypeOrmModule],
})
export class AuditModule {}
