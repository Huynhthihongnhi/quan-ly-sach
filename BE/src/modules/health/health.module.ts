import { Module } from '@nestjs/common';
import { CirculationModule } from '../circulation/circulation.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CirculationModule],
  controllers: [HealthController],
})
export class HealthModule {}
