import {assert,compareVersion,digest,fileHash,json,projectRoot} from './common.mjs';
import {verifyPremiumDelivery} from './artifacts.mjs';
import {readState,STATE} from './skills.mjs';
import {makePlan} from './transaction.mjs';

const surfaces={claude:'.claude/skills',cursor:'.cursor/skills',codex:'.agents/skills',opencode:'.agents/skills',grok:'.grok/skills',kimi:'.kimi-code/skills',copilot:'.github/skills'};
export function planDelivery(target,input,{provider='',now=Date.now()}={}) {
  const root=projectRoot(target), {artifact,entitlement}=verifyPremiumDelivery(input,{now});
  const manifest=artifact.manifest, state=readState(root), previous=state.skills[manifest.id], next=structuredClone(state), conflicts=[], changes=[];
  const providers=provider ? [...new Set(provider.split(','))].sort() : previous?.providers || [];
  assert(providers.every(p => surfaces[p]),'PROVIDER_UNSUPPORTED','Unknown artifact projection.',4);
  if (previous) {
    assert(previous.source === 'signed-offline','ARTIFACT_COLLISION','A bundled or foreign skill already owns this ID.',3);
    assert(compareVersion(manifest.version,previous.version) >= 0,'ARTIFACT_DOWNGRADE','Downgrades require transaction rollback.',4);
    assert(manifest.version !== previous.version || artifact.manifestDigest === previous.sourceDigest,'ARTIFACT_MUTABLE_RELEASE','An immutable release changed without a version change.',6);
  }
  const records=[];
  for (const prefix of [...new Set([`.vibekit/skills/${manifest.id}`,...providers.map(p => `${surfaces[p]}/${manifest.id}`)])]) for (const file of artifact.files) {
    const rel=`${prefix}/${file.path}`, current=fileHash(root,rel), owned=previous?.files.find(f => f.path === rel);
    if (current !== (owned?.sha256 || null)) conflicts.push({path:rel,reason:owned ? 'user-modified' : 'unowned'});
    changes.push({path:rel,data:file.data,reason:`Signed ${manifest.id}@${manifest.version}`}); records.push({path:rel,sha256:file.sha256,ownership:'managed'});
  }
  for (const old of previous?.files || []) if (!records.some(f => f.path === old.path)) {
    if (fileHash(root,old.path) !== old.sha256) conflicts.push({path:old.path,reason:'user-modified'});
    else changes.push({path:old.path,data:null,reason:'Archive obsolete signed artifact file'});
  }
  next.skills[manifest.id]={id:manifest.id,version:manifest.version,channel:manifest.channel,source:'signed-offline',sourceDigest:artifact.manifestDigest,license:manifest.license,providers,dependencies:[],requested:true,files:records};
  if (digest(next) !== digest(state)) changes.push({path:STATE,data:json(next),reason:'Signed artifact ownership and exact release digest'});
  return makePlan(root,'artifact add',changes,{skill:manifest.id,manifestDigest:artifact.manifestDigest,trustAnchorsDigest:digest(input.keys),entitlement:{status:entitlement.status,expiresAt:entitlement.expiresAt},conflicts,warnings:['Trust anchors were supplied by the operator. This is an offline delivery interface; production registry trust and revocation services are not configured.']});
}
