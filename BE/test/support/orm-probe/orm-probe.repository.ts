import { EntityManager } from 'typeorm';
import { OrmProbeEvent } from './entities/orm-probe-event.entity';
import { OrmProbeRecord } from './entities/orm-probe-record.entity';

export class OrmProbeRepository {
  constructor(private readonly manager: EntityManager) {}

  async insertRecord(record: Partial<OrmProbeRecord>): Promise<OrmProbeRecord> {
    const entity = this.manager.create(OrmProbeRecord, record);
    return this.manager.save(entity);
  }

  async insertEvent(event: Partial<OrmProbeEvent>): Promise<OrmProbeEvent> {
    const entity = this.manager.create(OrmProbeEvent, event);
    return this.manager.save(entity);
  }

  async findRecordById(id: string): Promise<OrmProbeRecord | null> {
    return this.manager.findOne(OrmProbeRecord, { where: { id } });
  }

  async updateLabelWithVersion(
    id: string,
    expectedVersion: number,
    label: string,
  ): Promise<number> {
    const result = await this.manager
      .createQueryBuilder()
      .update(OrmProbeRecord)
      .set({ label, version: () => 'version + 1' })
      .where('id = :id AND version = :expectedVersion', { id, expectedVersion })
      .execute();

    return result.affected ?? 0;
  }
}
