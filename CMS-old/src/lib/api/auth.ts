import { apiRequest } from './client';

interface LoginResponse {
  data: {
    user: { id: string; email: string; status: string };
    csrfToken: string;
  };
}

interface MeResponse {
  data: {
    userId: string;
    permissionCodes: string[];
  };
}

export async function login(email: string, password: string): Promise<LoginResponse['data']> {
  const response = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuthRedirect: true,
  });
  return response.data;
}

export async function fetchMe(options?: { skipAuthRedirect?: boolean }): Promise<MeResponse['data']> {
  const response = await apiRequest<MeResponse>('/auth/me', {
    skipAuthRedirect: options?.skipAuthRedirect ?? false,
  });
  return response.data;
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}

interface ForgotPasswordResponse {
  data: { message: string };
}

export async function forgotPassword(email: string): Promise<string> {
  const response = await apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuthRedirect: true,
  });
  return response.data.message;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiRequest<void>('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
    skipAuthRedirect: true,
  });
}

export async function activateAccount(token: string, newPassword: string): Promise<void> {
  await apiRequest<void>('/auth/activate', {
    method: 'POST',
    body: { token, newPassword },
    skipAuthRedirect: true,
  });
}
