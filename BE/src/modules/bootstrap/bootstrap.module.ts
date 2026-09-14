import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { DatabaseModule } from '../../platform/database/database.module';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { BootstrapService } from './bootstrap.service';

@Module({
  imports: [AppConfigModule, DatabaseModule, IdentityModule, AccessModule, AuditModule],
  providers: [BootstrapService],
  exports: [BootstrapService],
})
export class BootstrapModule {}
