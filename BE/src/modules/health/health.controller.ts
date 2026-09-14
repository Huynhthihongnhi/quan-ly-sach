import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/http/decorators/public.decorator';
import { SkipResponseEnvelope } from '../../common/http/decorators/skip-response-envelope.decorator';
import { CirculationInventoryService } from '../circulation/circulation-inventory.service';

@Public()
@SkipResponseEnvelope()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly circulationInventoryService: CirculationInventoryService,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok'; database: 'connected' }> {
    if (!this.dataSource.isInitialized) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'uninitialized',
      });
    }

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }

    await this.circulationInventoryService.assertSchemaReady();
    return { status: 'ok', database: 'connected' };
  }
}
