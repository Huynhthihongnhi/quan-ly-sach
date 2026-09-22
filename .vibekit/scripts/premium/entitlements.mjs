import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {assert,digest} from './common.mjs';

// Server-side building blocks. The CLI does not import, store or provision a signer.
export function newLicenseMaterial(pepper) {
  assert(Buffer.isBuffer(pepper) && pepper.length >= 32,'SERVER_KEY','Provide a server-owned pepper of at least 32 bytes.');
  const material=randomBytes(24).toString('base64url');
  return {displayOnce:`MVCK-P1-${material}`,lookupTag:createHmac('sha256',pepper).update(material).digest('hex')};
}
// Generic HMAC fixture protocol, not a Polar, Stripe or PayPal signature verifier.
// Production adapters must use the provider's verified body/headers and replay rules.
export function verifyWebhookHmac(raw,signature,key) {
  assert(Buffer.isBuffer(raw) && raw.length <= 1024*1024 && Buffer.isBuffer(key) && key.length >= 32,'WEBHOOK_INPUT','Invalid bounded webhook input.');
  if (!/^[a-f0-9]{64}$/.test(signature || '')) return false;
  return timingSafeEqual(createHmac('sha256',key).update(raw).digest(),Buffer.from(signature,'hex'));
}
export function reduceEntitlementEvent(state,event) {
  // sequence is a service-owned revision assigned after serialized reconciliation,
  // never webhook arrival order or a provider timestamp. See PREMIUM_SELLING.md.
  assert(state?.schemaVersion === 1 && state.events && state.entitlements,'ENTITLEMENT_STATE','Expected entitlement ledger schemaVersion 1.');
  assert(event && ['subscription.started','subscription.renewed','subscription.past_due','subscription.ended','purchase.refunded','updates.extended'].includes(event.type),'ENTITLEMENT_EVENT','Unsupported entitlement event.');
  assert(/^[A-Za-z0-9_-]{1,128}$/.test(event.id) && /^[A-Za-z0-9_-]{1,128}$/.test(event.entitlementId) && Number.isSafeInteger(event.sequence) && event.sequence >= 0,'ENTITLEMENT_EVENT','Invalid event identity or ordering sequence.');
  assert(!['__proto__','constructor','prototype'].includes(event.id) && !['__proto__','constructor','prototype'].includes(event.entitlementId),'ENTITLEMENT_EVENT','Reserved ledger identity.');
  const eventDigest=digest(event), prior=Object.hasOwn(state.events,event.id) ? state.events[event.id] : null;
  if (prior) { assert(prior.digest === eventDigest,'EVENT_REPLAY_CONFLICT','Event ID was reused for different content.'); return {state,status:'duplicate'}; }
  const next=structuredClone(state), current=Object.hasOwn(next.entitlements,event.entitlementId) ? next.entitlements[event.entitlementId] : null;
  next.events[event.id]={digest:eventDigest,sequence:event.sequence,entitlementId:event.entitlementId};
  if (current && event.sequence <= current.sequence) return {state:next,status:'stale'};
  const statuses={'subscription.started':'active','subscription.renewed':'active','subscription.past_due':'grace','subscription.ended':'expired','purchase.refunded':'revoked'};
  assert(event.type !== 'updates.extended' || current,'ENTITLEMENT_MISSING','An update extension requires an existing entitlement.');
  // Refunded grants are terminal. A later renewal needs a separately issued
  // entitlement ID after server review; webhook order cannot reinstate it.
  const status=current?.status === 'revoked' ? 'revoked' : statuses[event.type] || current.status;
  const updatesUntil=event.updatesUntil || current?.updatesUntil;
  assert(Number.isFinite(Date.parse(updatesUntil)),'ENTITLEMENT_WINDOW','A valid update window is required.');
  next.entitlements[event.entitlementId]={status,updatesUntil,sequence:event.sequence,sourceEvent:event.id};
  return {state:next,status:'applied'};
}
export function ingestVerifiedEvent(state,raw,signature,{verifySignature,decodeEvent}) {
  assert(typeof verifySignature === 'function' && typeof decodeEvent === 'function','PAYMENT_ADAPTER','A server-owned signature verifier and event decoder are required.');
  assert(verifySignature(raw,signature) === true,'WEBHOOK_SIGNATURE','Webhook signature rejected.');
  return reduceEntitlementEvent(state,decodeEvent(raw));
}
export function licensingStatus() {
  return {schemaVersion:1,mode:'community',service:'not-configured',licenseVerification:'not-performed',accessNote:'Local bundled commands do not verify a purchase. Each component retains its declared license.',publicCommands:'available',premiumDownloads:'blocked',installedFiles:'preserved',credentialStorage:'not-configured',telemetry:'off',network:'not-requested',releaseGates:['Choose and configure the entitlement service and payment adapter.','Provision public trust anchors from a separately controlled signer.','Integrate and test the OS credential store on supported platforms.','Complete legal, privacy, abuse-control and external security review.']};
}
