import {createPublicKey, verify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {assert, canonical, compareVersion, digest, relativePath, satisfies, semver, sha256, uniquePaths} from './common.mjs';

const limits={manifestBytes:1024*1024,bundleBytes:24*1024*1024,fileBytes:2*1024*1024,expandedBytes:16*1024*1024,files:1000};
const CLI_VERSION = readFileSync(new URL('../../KIT_VERSION', import.meta.url), 'utf8').trim();
const text = value => typeof value === 'string' && value.length > 0;
function exactKeys(value,allowed,required=allowed) {
  assert(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value,key)),'SIGNED_SCHEMA','Unknown or missing signed field.',6);
}
export function verifyEnvelope(envelope,trustedKeys,type,{now=Date.now()}={}) {
  exactKeys(envelope,['payload','signature']);
  exactKeys(envelope.signature,['algorithm','keyId','value']);
  assert(envelope.signature.algorithm === 'Ed25519','SIGNATURE_ALGORITHM','Only Ed25519 signatures are accepted.',6);
  assert(Buffer.byteLength(canonical(envelope.payload)) <= limits.manifestBytes,'SIGNED_SIZE','Signed payload exceeds the size limit.',6);
  const key=trustedKeys.find(k => k.id === envelope.signature.keyId);
  assert(key && key.use === type && key.status === 'active','SIGNING_KEY','Unknown, retired or wrong-purpose signing key.',6);
  assert(text(key.publicKey) && key.publicKey.trim().startsWith('-----BEGIN PUBLIC KEY-----') && !key.publicKey.includes('PRIVATE KEY'),'SIGNING_KEY_TYPE','Provide a public verification key, never private signing material.',6);
  assert((!key.notBefore || Date.parse(key.notBefore) <= now) && (!key.notAfter || Date.parse(key.notAfter) > now),'SIGNING_KEY_EXPIRED','Signing key is outside its trust window.',6);
  let publicKey;
  try { publicKey=createPublicKey(key.publicKey); } catch { assert(false,'SIGNING_KEY','Invalid public verification key.',6); }
  assert(publicKey.asymmetricKeyType === 'ed25519','SIGNING_KEY_TYPE','Expected an Ed25519 public key.',6);
  assert(/^[A-Za-z0-9_-]{86}$/.test(envelope.signature.value),'SIGNATURE_ENCODING','Invalid signature encoding.',6);
  const signature=Buffer.from(envelope.signature.value,'base64url');
  assert(signature.toString('base64url') === envelope.signature.value && verify(null,Buffer.from(canonical(envelope.payload)),publicKey,signature),'SIGNATURE_INVALID','Signature verification failed.',6);
  assert(envelope.payload.type === type && envelope.payload.schemaVersion === 1,'SIGNED_TYPE','Wrong signed object type or protocol version.',6);
  return envelope.payload;
}
export function verifyLease(envelope,trustedKeys,{issuer,installation,product,feature,version,releasedAt,offline=false,now=Date.now(),revokedIds=[],lastTrustedTime}={}) {
  const lease=verifyEnvelope(envelope,trustedKeys,'mvck-entitlement-v1',{now});
  exactKeys(lease,['schemaVersion','type','issuer','audience','subject','id','installation','product','features','allowedVersions','updatesUntil','issuedAt','notBefore','expiresAt','graceUntil','status']);
  assert(lease.issuer === issuer && lease.audience === 'mvck-premium-cli' && text(lease.subject) && text(lease.id) && lease.installation === installation && lease.product === product,'ENTITLEMENT_BINDING','Entitlement identity, audience or installation mismatch.',5);
  assert(lease.status === 'active' && !revokedIds.includes(lease.id),'ENTITLEMENT_REVOKED','Entitlement is not active.',5);
  assert(Array.isArray(lease.features) && lease.features.every(text) && lease.features.includes(feature),'ENTITLEMENT_FEATURE','Required feature is not entitled.',5);
  const times=['issuedAt','notBefore','expiresAt','graceUntil','updatesUntil'].map(k => Date.parse(lease[k]));
  assert(times.every(Number.isFinite) && times[0] <= times[1] && times[1] < times[2] && times[2] <= times[3],'ENTITLEMENT_TIME','Invalid entitlement time bounds.',5);
  assert(now >= times[1] && now < (offline ? times[3] : times[2]),'ENTITLEMENT_EXPIRED','Entitlement is not yet valid or has expired; installed files remain available.',5);
  assert(!lastTrustedTime || now >= Date.parse(lastTrustedTime)-300000,'ENTITLEMENT_CLOCK','Clock moved before the last trusted observation. Refresh online.',5);
  assert(satisfies(version,lease.allowedVersions) && Number.isFinite(Date.parse(releasedAt)) && Date.parse(releasedAt) <= times[4],'ENTITLEMENT_VERSION','Release is outside the licensed version or update window.',5);
  return {status:now >= times[2] ? 'grace' : 'valid',id:lease.id,product:lease.product,feature,expiresAt:lease.expiresAt,updatesUntil:lease.updatesUntil,offline,revocation:'Caller-supplied revocation snapshot; offline revocation freshness is bounded by the lease.'};
}
export function verifyArtifact(envelope,bundle,trustedKeys,{id,version,channel='stable',cliVersion=CLI_VERSION,withdrawn=[],now=Date.now()}={}) {
  const manifest=verifyEnvelope(envelope,trustedKeys,'mvck-release-v1',{now});
  exactKeys(manifest,['schemaVersion','type','id','version','channel','product','feature','license','releasedAt','minimumCli','bundleSha256','files']);
  assert(/^[a-z][a-z0-9-]*$/.test(manifest.id) && manifest.id === id && manifest.version === version && manifest.channel === channel && ['stable','beta','canary'].includes(channel),'ARTIFACT_BINDING','Release identity, version or channel mismatch.',6);
  semver(version); semver(manifest.minimumCli);
  assert(compareVersion(cliVersion,manifest.minimumCli) >= 0,'CLI_TOO_OLD',`Release requires CLI ${manifest.minimumCli}.`,4);
  assert(!withdrawn.includes(`${id}@${version}`) && Number.isFinite(Date.parse(manifest.releasedAt)) && Date.parse(manifest.releasedAt) <= now,'ARTIFACT_WITHDRAWN','Release is withdrawn or has an invalid publication date.',6);
  assert(text(manifest.product) && text(manifest.feature) && text(manifest.license),'ARTIFACT_ENTITLEMENT','Release product, feature and license are required.',6);
  exactKeys(bundle,['schemaVersion','type','files']);
  assert(bundle.schemaVersion === 1 && bundle.type === 'mvck-file-bundle-v1' && Array.isArray(bundle.files),'BUNDLE_FORMAT','Only the bounded regular-file JSON bundle format is supported. Archives and links are refused.',6);
  assert(Buffer.byteLength(canonical(bundle)) <= limits.bundleBytes && digest(bundle) === manifest.bundleSha256,'BUNDLE_DIGEST','Bundle digest or size mismatch.',6);
  assert(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= limits.files && bundle.files.length === manifest.files.length,'BUNDLE_FILES','Bundle file count mismatch.',6);
  uniquePaths(manifest.files.map(f => f.path)); uniquePaths(bundle.files.map(f => f.path));
  let expanded=0;
  const files=manifest.files.map(file => {
    exactKeys(file,['path','sha256','size']); relativePath(file.path);
    assert(!file.path.split('/').some(p => /^\.git$|^\.env|secret|token|credential/i.test(p)),'BUNDLE_PATH','Sensitive destinations are prohibited.',6);
    assert(Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= limits.fileBytes && /^[a-f0-9]{64}$/.test(file.sha256),'BUNDLE_FILE_SCHEMA','Invalid file size or digest.',6);
    const entry=bundle.files.find(f => f.path === file.path);
    exactKeys(entry,['path','type','data']);
    assert(entry.type === 'file' && typeof entry.data === 'string' && entry.data.length <= Math.ceil(limits.fileBytes/3)*4 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.data),'BUNDLE_ENTRY','Only canonical base64 regular files are supported.',6);
    const data=Buffer.from(entry.data,'base64'); expanded+=data.length;
    assert(expanded <= limits.expandedBytes && data.length === file.size && sha256(data) === file.sha256 && data.toString('base64') === entry.data,'FILE_DIGEST','Expanded file size or digest mismatch.',6);
    const magic=data.subarray(0,4).toString('hex');
    assert(!['7f454c46','feedface','feedfacf','cefaedfe','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca'].includes(magic) && data.subarray(0,2).toString() !== 'MZ','BINARY_EXECUTABLE','Binary executables are not accepted in skill bundles.',6);
    return {...file,data};
  });
  assert(files.some(f => f.path === 'SKILL.md'),'ARTIFACT_ENTRYPOINT','The artifact needs SKILL.md.',6);
  return {manifest,manifestDigest:digest(manifest),files,signature:'verified',lifecycleExecution:'disabled'};
}
export function verifyPremiumDelivery({release,bundle,lease,keys,request},{now=Date.now()}={}) {
  assert(request && text(request.id) && text(request.version) && text(request.issuer) && text(request.installation), 'DELIVERY_REQUEST', 'Expected artifact, issuer and installation bindings.', 5);
  assert(Array.isArray(keys) && keys.length > 0 && new Set(keys.map(k => k.id)).size === keys.length, 'SIGNING_KEY', 'A unique operator-reviewed public key set is required.', 6);
  // The delivered JSON may select an artifact, but cannot assert a newer CLI.
  const artifact=verifyArtifact(release,bundle,keys,{...request,now,cliVersion:CLI_VERSION});
  const entitlement=verifyLease(lease,keys,{...request,now,product:artifact.manifest.product,feature:artifact.manifest.feature,releasedAt:artifact.manifest.releasedAt});
  return {artifact,entitlement};
}
export const ARTIFACT_LIMITS=Object.freeze(limits);
