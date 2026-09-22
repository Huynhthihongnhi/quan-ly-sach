import { Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { AdminPurchaseListQueryDto, OwnPurchaseListQueryDto } from './dto/purchase-list-query.dto';
import { ReviewPurchaseRequestDto } from './dto/review-purchase-request.dto';
import {
  PurchaseRequestDetailResponse,
  PurchaseRequestResponse,
  toPurchaseRequestEventResponse,
  toPurchaseRequestResponse,
} from './mappers/purchase-request.mapper';
import { buildPurchaseRequestHash } from './purchase-request-hash.util';
import { PurchasesRepository } from './purchases.repository';

export interface CreatePurchaseRequestResult {
  replay: boolean;
  data: PurchaseRequestResponse;
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly purchasesRepository: PurchasesRepository,
    private readonly auditService: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async createRequest(params: {
    requesterId: string;
    body: CreatePurchaseRequestDto;
    idempotencyKey: string;
    requestId: string;
  }): Promise<CreatePurchaseRequestResult> {
    const note = params.body.note?.trim() ? params.body.note.trim() : null;
    const requestHash = buildPurchaseRequestHash({
      title: params.body.title,
      authorText: params.body.authorText,
      publicationYear: params.body.publicationYear,
      note,
    });

    const existing = await this.purchasesRepository.findByRequesterAndKey(
      params.requesterId,
      params.idempotencyKey,
    );
    if (existing) {
      if (!requestHashesMatch(existing.requestHash, requestHash)) {
        throw new ApiException(
          409,
          ErrorCode.IDEMPOTENCY_CONFLICT,
          'Idempotency key was already used with a different payload.',
        );
      }
      return { replay: true, data: toPurchaseRequestResponse(existing) };
    }

    const now = this.clock.now();
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const row = await this.purchasesRepository.insertRequest(manager, {
          requesterId: params.requesterId,
          title: params.body.title.trim(),
          authorText: params.body.authorText.trim(),
          publicationYear: params.body.publicationYear,
          note,
          requestKey: params.idempotencyKey,
          requestHash,
          createdAt: now,
        });
        await this.purchasesRepository.appendEvent(manager, {
          purchaseRequestId: row.id,
          actorUserId: params.requesterId,
          fromState: null,
          toState: 'pending',
        });
        await this.auditService.append(manager, {
          actorUserId: params.requesterId,
          action: 'purchase_request.create',
          targetType: 'purchase_request',
          targetId: row.id,
          outcome: 'success',
          requestId: params.requestId,
          details: { state: 'pending' },
        });
        return row;
      });
      return { replay: false, data: toPurchaseRequestResponse(saved) };
    } catch (error) {
      if (isDuplicateRequestKeyError(error)) {
        const replayRow = await this.purchasesRepository.findByRequesterAndKey(
          params.requesterId,
          params.idempotencyKey,
        );
        if (replayRow && requestHashesMatch(replayRow.requestHash, requestHash)) {
          return { replay: true, data: toPurchaseRequestResponse(replayRow) };
        }
        throw new ApiException(
          409,
          ErrorCode.IDEMPOTENCY_CONFLICT,
          'Idempotency key was already used with a different payload.',
        );
      }
      throw error;
    }
  }

  async listOwnRequests(requesterId: string, query: OwnPurchaseListQueryDto) {
    const { items, total } = await this.purchasesRepository.listForRequester({
      requesterId,
      state: query.state,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: items.map(toPurchaseRequestResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async listAdminRequests(query: AdminPurchaseListQueryDto) {
    const { items, total } = await this.purchasesRepository.listQueue({
      state: query.state,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: items.map(toPurchaseRequestResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async getRequestDetail(params: {
    purchaseRequestId: string;
    actingUserId: string;
    permissionCodes: string[];
  }): Promise<PurchaseRequestDetailResponse> {
    const row = await this.purchasesRepository.findById(params.purchaseRequestId);
    if (!row) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Purchase request was not found.');
    }
    const canReadAny = params.permissionCodes.includes('purchases.read.any');
    if (!canReadAny && row.requesterId !== params.actingUserId) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'Purchase request does not belong to the signed-in user.',
      );
    }
    const events = await this.purchasesRepository.listEvents(row.id);
    return {
      ...toPurchaseRequestResponse(row),
      events: events.map(toPurchaseRequestEventResponse),
    };
  }

  async reviewRequest(params: {
    purchaseRequestId: string;
    reviewerId: string;
    body: ReviewPurchaseRequestDto;
    requestId: string;
  }): Promise<PurchaseRequestResponse> {
    const existing = await this.purchasesRepository.findById(params.purchaseRequestId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Purchase request was not found.');
    }

    if (existing.requesterId === params.reviewerId) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'Requesters cannot review their own purchase requests.',
      );
    }

    if (existing.state !== 'pending') {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Only pending purchase requests can be reviewed.',
      );
    }

    const reviewReason =
      params.body.decision === 'rejected'
        ? params.body.reason!.trim()
        : (params.body.reason?.trim() ?? null);

    const now = this.clock.now();
    const updated = await this.dataSource.transaction(async (manager) => {
      const row = await this.purchasesRepository.transitionReviewWithVersion(manager, {
        purchaseRequestId: params.purchaseRequestId,
        expectedVersion: params.body.version,
        toState: params.body.decision,
        reviewedBy: params.reviewerId,
        reviewReason,
        reviewedAt: now,
      });

      if (!row) {
        const fresh = await this.purchasesRepository.findById(params.purchaseRequestId);
        if (!fresh) {
          throw new ApiException(404, ErrorCode.NOT_FOUND, 'Purchase request was not found.');
        }
        if (fresh.state !== 'pending') {
          throw new ApiException(
            409,
            ErrorCode.INVALID_TRANSITION,
            'Only pending purchase requests can be reviewed.',
          );
        }
        throw new ApiException(
          409,
          ErrorCode.VERSION_CONFLICT,
          'Purchase request version is stale.',
        );
      }

      await this.purchasesRepository.appendEvent(manager, {
        purchaseRequestId: row.id,
        actorUserId: params.reviewerId,
        fromState: 'pending',
        toState: params.body.decision,
        reason: reviewReason,
      });

      await this.auditService.append(manager, {
        actorUserId: params.reviewerId,
        action: 'purchase_request.review',
        targetType: 'purchase_request',
        targetId: row.id,
        outcome: 'success',
        requestId: params.requestId,
        details: { decision: params.body.decision, from: 'pending', to: params.body.decision },
      });

      return row;
    });

    return toPurchaseRequestResponse(updated);
  }
}

function requestHashesMatch(stored: Buffer, incoming: Buffer): boolean {
  if (stored.length !== incoming.length) {
    return false;
  }
  return timingSafeEqual(stored, incoming);
}

function isDuplicateRequestKeyError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = (error as QueryFailedError & { driverError?: { message?: string } })
    .driverError;
  const message = driverError?.message ?? error.message;
  return (
    (error as { code?: string }).code === 'ER_DUP_ENTRY' &&
    message.includes('uq_purchase_request_key')
  );
}
