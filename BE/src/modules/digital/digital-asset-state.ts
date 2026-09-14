import type { DigitalAssetState } from './entities/digital-asset.entity';

const ALLOWED_TRANSITIONS: Record<DigitalAssetState, readonly DigitalAssetState[]> = {
  quarantine: ['ready', 'rejected', 'archived'],
  ready: ['archived'],
  rejected: ['archived'],
  archived: [],
};

export function isAllowedDigitalAssetStateTransition(
  from: DigitalAssetState,
  to: DigitalAssetState,
): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}
