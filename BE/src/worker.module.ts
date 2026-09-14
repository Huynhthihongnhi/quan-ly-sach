import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { DatabaseModule } from './platform/database/database.module';
import { ClockModule } from './platform/clock/clock.module';

@Module({
  imports: [AppConfigModule, ClockModule, DatabaseModule, MessagingModule],
})
export class WorkerModule {}
