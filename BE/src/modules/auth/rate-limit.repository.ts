import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { sha256Digest } from './crypto/digest';
import { RateLimitBucket } from './entities/rate-limit-bucket.entity';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

@Injectable()
export class RateLimitRepository {
  constructor(
    @InjectRepository(RateLimitBucket)
    private readonly buckets: Repository<RateLimitBucket>,
  ) {}

  hashSubject(secret: string, subject: string): Buffer {
    return sha256Digest(createHmac('sha256', secret).update(subject).digest());
  }

  async consume(
    manager: EntityManager,
    params: {
      scope: string;
      subjectHash: Buffer;
      windowStart: Date;
      expiresAt: Date;
      maxRequests: number;
      now: Date;
    },
  ): Promise<RateLimitResult> {
    await manager.query(
      `INSERT INTO rate_limit_buckets (scope, subject_hash, window_start, expires_at, request_count)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
      [params.scope, params.subjectHash, params.windowStart, params.expiresAt],
    );

    const bucket = await manager.findOne(RateLimitBucket, {
      where: {
        scope: params.scope,
        subjectHash: params.subjectHash,
        windowStart: params.windowStart,
      },
    });

    const count = bucket?.requestCount ?? 1;
    const allowed = count <= params.maxRequests;
    const retryAfterMs = Math.max(0, params.expiresAt.getTime() - params.now.getTime());

    return { allowed, retryAfterMs };
  }
}
