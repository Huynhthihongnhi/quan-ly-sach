import { UserStatus } from './entities/user.entity';

const ALLOWED_STATUS_TRANSITIONS: Record<UserStatus, readonly UserStatus[]> = {
  invited: ['blocked', 'archived'],
  active: ['blocked', 'archived'],
  blocked: ['active', 'archived'],
  archived: [],
};

export function isAllowedStatusTransition(from: UserStatus, to: UserStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function requiresSessionInvalidation(_from: UserStatus, to: UserStatus): boolean {
  return to === 'blocked' || to === 'archived';
}
