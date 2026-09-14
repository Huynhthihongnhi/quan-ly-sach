import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DataSource } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { parseSortParam } from '../../common/http/pagination/sort-allowlist';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { IamPolicyError, IamPolicyService } from '../access/iam-policy.service';
import { AuditService } from '../audit/audit.service';
import { AuthChallengeConfigService } from '../auth/auth-challenge-config.service';
import { AuthService } from '../auth/auth.service';
import { ChallengeOutboxOrchestrator } from '../messaging/challenge-outbox.orchestrator';
import { UserRepository } from '../identity/user.repository';
import {
  isAllowedStatusTransition,
  requiresSessionInvalidation,
} from '../identity/user-status-transitions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import {
  ProfileResponse,
  toProfileResponse,
  toUserResponse,
  UserResponse,
} from './mappers/user.mapper';

const USER_SORT_ALLOWLIST = ['id', 'email', 'createdAt'] as const;

export const ACTIVATION_EMAIL_ACCEPTED_MESSAGE =
  'If the account is eligible, activation instructions will be sent shortly.';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly iamPolicyService: IamPolicyService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly challengeConfig: AuthChallengeConfigService,
    private readonly challengeOutboxOrchestrator: ChallengeOutboxOrchestrator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listUsers(query: UserListQueryDto): Promise<{
    data: UserResponse[];
    meta: ReturnType<typeof buildPageMeta>;
  }> {
    const { field, direction } = parseSortParam(query.sort, USER_SORT_ALLOWLIST);
    const sortField = field as (typeof USER_SORT_ALLOWLIST)[number];
    const sortDirection = direction === 'asc' ? 'ASC' : 'DESC';
    const { items, total } = await this.userRepository.listUsers({
      q: query.q,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
      sortField,
      sortDirection,
    });

    return {
      data: items.map(toUserResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async getUser(userId: string): Promise<UserResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'User was not found.');
    }
    return toUserResponse(user);
  }

  async createUser(
    body: CreateUserDto,
    actorUserId: string,
    requestId: string,
  ): Promise<UserResponse> {
    try {
      const { user } = await this.dataSource.transaction(async (manager) => {
        const created = await this.userRepository.createWithProfile(manager, {
          email: body.email,
          displayName: body.displayName,
          phone: body.phone ?? null,
          status: 'invited',
        });

        await this.auditService.append(manager, {
          actorUserId,
          action: 'users.create',
          targetType: 'user',
          targetId: created.user.id,
          outcome: 'success',
          requestId,
          details: { email: created.user.email, status: created.user.status },
        });

        return created;
      });

      return toUserResponse(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ApiException(409, ErrorCode.EMAIL_CONFLICT, 'Email is already in use.');
      }
      throw error;
    }
  }

  async updateUserStatus(
    userId: string,
    body: UpdateUserStatusDto,
    actorUserId: string,
    requestId: string,
  ): Promise<UserResponse> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'User was not found.');
    }

    if (body.status === 'active' && existing.status !== 'blocked') {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Only blocked users can be re-enabled through this endpoint.',
      );
    }

    if (!isAllowedStatusTransition(existing.status, body.status)) {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'User status transition is not allowed.',
      );
    }

    const now = this.clock.now();
    const invalidateSessions = requiresSessionInvalidation(existing.status, body.status);

    try {
      const updated = await this.dataSource.transaction(async (manager) => {
        if (invalidateSessions) {
          await this.iamPolicyService.assertRetainsLastAdmin(manager, {
            targetUserId: userId,
            wouldBlockOrArchive: true,
          });
        }

        const user = await this.userRepository.updateStatusWithVersion(manager, {
          userId,
          expectedVersion: body.version,
          status: body.status,
          now,
        });

        if (!user) {
          throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'User version is stale.');
        }

        if (invalidateSessions) {
          await this.authService.revokeAllSessionsForUserInTransaction(manager, userId, now);
        }

        await this.auditService.append(manager, {
          actorUserId,
          action: 'users.status.update',
          targetType: 'user',
          targetId: userId,
          outcome: 'success',
          requestId,
          details: { from: existing.status, to: body.status },
        });

        return user;
      });

      return toUserResponse(updated);
    } catch (error) {
      if (error instanceof IamPolicyError && error.code === 'last_admin_denied') {
        throw new ApiException(
          409,
          ErrorCode.LAST_ADMIN_REQUIRED,
          'Operation would remove the last active admin.',
        );
      }
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<ProfileResponse> {
    const profile = await this.userRepository.findProfileByUserId(userId);
    if (!profile) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Profile was not found.');
    }
    return toProfileResponse(profile);
  }

  async updateUserProfile(
    userId: string,
    body: UpdateProfileDto,
    actorUserId: string,
    requestId: string,
  ): Promise<ProfileResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'User was not found.');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const profile = await this.userRepository.updateProfileWithVersion(manager, {
        userId,
        expectedVersion: body.version,
        displayName: body.displayName,
        phone: body.phone,
      });

      if (!profile) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Profile version is stale.');
      }

      await this.auditService.append(manager, {
        actorUserId,
        action: 'profiles.update',
        targetType: 'profile',
        targetId: userId,
        outcome: 'success',
        requestId,
      });

      return profile;
    });

    return toProfileResponse(updated);
  }

  async getOwnProfile(userId: string): Promise<ProfileResponse> {
    return this.getUserProfile(userId);
  }

  async updateOwnProfile(
    userId: string,
    body: UpdateProfileDto,
    requestId: string,
  ): Promise<ProfileResponse> {
    return this.updateUserProfile(userId, body, userId, requestId);
  }

  async sendActivationEmail(
    userId: string,
    actorUserId: string,
    requestId: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'User was not found.');
    }

    if (user.status !== 'invited') {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Activation email can only be sent to invited users.',
      );
    }

    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.challengeConfig.activationTtlMs);

    await this.dataSource.transaction(async (manager) => {
      await this.challengeOutboxOrchestrator.enqueueChallengeEmail(manager, {
        userId: user.id,
        purpose: 'activate_account',
        email: user.email,
        challengeExpiresAt: expiresAt,
        outboxExpiresAt: expiresAt,
        templateCode: 'activate_account',
        dedupeKey: `activate_account:${user.id}:${randomUUID()}`,
      });

      await this.auditService.append(manager, {
        actorUserId,
        action: 'users.activation_email',
        targetType: 'user',
        targetId: user.id,
        outcome: 'success',
        requestId,
      });
    });

    return { message: ACTIVATION_EMAIL_ACCEPTED_MESSAGE };
  }
}
