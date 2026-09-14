import { Request } from 'express';

export interface RequestActor {
  userId: string;
  permissionCodes: string[];
}

export interface SessionContext {
  sessionId: string;
  csrfToken: string;
  sessionToken: Buffer;
}

export interface RequestContext {
  requestId: string;
  actor: RequestActor | null;
  sessionContext?: SessionContext;
}

export type RequestWithContext = Request & RequestContext;
