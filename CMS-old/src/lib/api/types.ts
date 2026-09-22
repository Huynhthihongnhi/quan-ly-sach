export interface ApiErrorField {
  field: string;
  code: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    fields?: ApiErrorField[];
  };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface UserRecord {
  id: string;
  email: string;
  status: string;
  version: string;
  createdAt: string;
}

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  version: string;
  createdAt: string;
  permissionCodes?: string[];
}

export interface PermissionRecord {
  id: string;
  code: string;
  description: string;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: ApiErrorField[],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
