export function buildSessionCookie(
  cookieName: string,
  sessionToken: Buffer,
  maxAgeMs: number,
  isProduction: boolean,
): string {
  const parts = [
    `${cookieName}=${sessionToken.toString('base64url')}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];

  if (isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildClearSessionCookie(cookieName: string, isProduction: boolean): string {
  const parts = [`${cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProduction) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
