import type { LoanState } from './entities/loan.entity';

export type LoanTransitionAction = 'cancel' | 'checkout' | 'return' | 'mark_lost';

const TRANSITIONS: Record<LoanTransitionAction, { from: LoanState[]; to: LoanState }> = {
  cancel: { from: ['reserved'], to: 'cancelled' },
  checkout: { from: ['reserved'], to: 'borrowed' },
  return: { from: ['borrowed'], to: 'returned' },
  mark_lost: { from: ['borrowed'], to: 'lost' },
};

export function targetStateForAction(action: LoanTransitionAction): LoanState {
  return TRANSITIONS[action].to;
}

export function isAllowedLoanTransition(
  action: LoanTransitionAction,
  currentState: LoanState,
): boolean {
  return TRANSITIONS[action].from.includes(currentState);
}

export function assertReservationActiveForCheckout(reservationExpiresAt: Date, now: Date): boolean {
  return now < reservationExpiresAt;
}

export function isReturnCopyCondition(value: string): value is 'serviceable' | 'repair' {
  return value === 'serviceable' || value === 'repair';
}
