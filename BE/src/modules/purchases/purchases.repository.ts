import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PurchaseRequest, PurchaseRequestState } from './entities/purchase-request.entity';
import { PurchaseRequestEvent } from './entities/purchase-request-event.entity';

export interface InsertPurchaseRequestInput {
  requesterId: string;
  title: string;
  authorText: string;
  publicationYear: number;
  note: string | null;
  requestKey: string;
  requestHash: Buffer;
  createdAt: Date;
}

@Injectable()
export class PurchasesRepository {
  constructor(
    @InjectRepository(PurchaseRequest)
    private readonly requests: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestEvent)
    private readonly events: Repository<PurchaseRequestEvent>,
  ) {}

  findById(id: string): Promise<PurchaseRequest | null> {
    return this.requests.findOne({ where: { id } });
  }

  findByRequesterAndKey(requesterId: string, requestKey: string): Promise<PurchaseRequest | null> {
    return this.requests.findOne({ where: { requesterId, requestKey } });
  }

  async listForRequester(params: {
    requesterId: string;
    state?: PurchaseRequestState;
    page: number;
    pageSize: number;
  }): Promise<{ items: PurchaseRequest[]; total: number }> {
    const qb = this.requests
      .createQueryBuilder('pr')
      .where('pr.requester_id = :requesterId', { requesterId: params.requesterId });
    if (params.state) {
      qb.andWhere('pr.state = :state', { state: params.state });
    }
    const total = await qb.getCount();
    const items = await qb
      .orderBy('pr.id', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();
    return { items, total };
  }

  async listQueue(params: {
    state?: PurchaseRequestState;
    page: number;
    pageSize: number;
  }): Promise<{ items: PurchaseRequest[]; total: number }> {
    const qb = this.requests.createQueryBuilder('pr');
    if (params.state) {
      qb.andWhere('pr.state = :state', { state: params.state });
    }
    const total = await qb.getCount();
    const items = await qb
      .orderBy('pr.id', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();
    return { items, total };
  }

  listEvents(purchaseRequestId: string): Promise<PurchaseRequestEvent[]> {
    return this.events.find({
      where: { purchaseRequestId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async insertRequest(
    manager: EntityManager,
    input: InsertPurchaseRequestInput,
  ): Promise<PurchaseRequest> {
    const result: { insertId: number } = await manager.query(
      `INSERT INTO purchase_requests
       (requester_id, title, author_text, publication_year, note, state, request_key, request_hash, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        input.requesterId,
        input.title,
        input.authorText,
        input.publicationYear,
        input.note,
        input.requestKey,
        input.requestHash,
        input.createdAt,
      ],
    );
    const row = await manager
      .getRepository(PurchaseRequest)
      .findOne({ where: { id: String(result.insertId) } });
    if (!row) {
      throw new Error('Purchase request insert failed to reload row');
    }
    return row;
  }

  async appendEvent(
    manager: EntityManager,
    input: {
      purchaseRequestId: string;
      actorUserId: string;
      fromState: string | null;
      toState: string;
      reason?: string | null;
    },
  ): Promise<void> {
    await manager.getRepository(PurchaseRequestEvent).insert({
      purchaseRequestId: input.purchaseRequestId,
      actorUserId: input.actorUserId,
      fromState: input.fromState,
      toState: input.toState,
      reason: input.reason ?? null,
    });
  }

  async transitionReviewWithVersion(
    manager: EntityManager,
    input: {
      purchaseRequestId: string;
      expectedVersion: string;
      toState: Exclude<PurchaseRequestState, 'pending'>;
      reviewedBy: string;
      reviewReason: string | null;
      reviewedAt: Date;
    },
  ): Promise<PurchaseRequest | null> {
    const result = await manager
      .getRepository(PurchaseRequest)
      .createQueryBuilder()
      .update(PurchaseRequest)
      .set({
        state: input.toState,
        reviewedBy: input.reviewedBy,
        reviewReason: input.reviewReason,
        reviewedAt: input.reviewedAt,
        version: () => 'version + 1',
      })
      .where('id = :id', { id: input.purchaseRequestId })
      .andWhere('state = :pending', { pending: 'pending' })
      .andWhere('version = :expectedVersion', { expectedVersion: input.expectedVersion })
      .execute();

    if ((result.affected ?? 0) !== 1) {
      return null;
    }

    return manager.getRepository(PurchaseRequest).findOne({
      where: { id: input.purchaseRequestId },
    });
  }
}
