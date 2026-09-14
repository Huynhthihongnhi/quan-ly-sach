import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../../src/modules/health/health.controller';
import { CirculationInventoryService } from '../../src/modules/circulation/circulation-inventory.service';
import { DataSource } from 'typeorm';

describe('HealthController', () => {
  const createController = (
    dataSource: Partial<DataSource>,
    circulationInventory: Partial<CirculationInventoryService> = {
      assertSchemaReady: jest.fn().mockResolvedValue(undefined),
    },
  ): HealthController => {
    return new HealthController(
      dataSource as DataSource,
      circulationInventory as CirculationInventoryService,
    );
  };

  it('returns ok from live probe without touching the database', () => {
    const controller = createController({});
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('returns ready when database responds', async () => {
    const controller = createController({
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '1': 1 }]),
    });

    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('returns 503 when database is uninitialized', async () => {
    const controller = createController({ isInitialized: false });

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns 503 when database query fails', async () => {
    const controller = createController({
      isInitialized: true,
      query: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
