function hostMatchesWildcard(host: string, hostPattern: string): boolean {
  if (!hostPattern.startsWith('*.')) {
    return host === hostPattern;
  }

  const suffix = hostPattern.slice(1);
  if (!host.endsWith(suffix)) {
    return false;
  }

  const prefix = host.slice(0, host.length - suffix.length);
  return prefix.length > 0 && !prefix.endsWith('.');
}

/**
 * Returns true when `origin` matches an allowlist entry.
 * Supports exact origins and dev-friendly host wildcards such as `https://*.trycloudflare.com`
 * or `*.trycloudflare.com` (https only).
 */
export function isOriginAllowed(origin: string, allowedOrigins: readonly string[]): boolean {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  for (const pattern of allowedOrigins) {
    if (!pattern.includes('*')) {
      continue;
    }

    if (pattern.includes('://')) {
      const schemeSplit = pattern.indexOf('://');
      const expectedProtocol = `${pattern.slice(0, schemeSplit)}:`;
      if (parsed.protocol !== expectedProtocol) {
        continue;
      }

      const hostPattern = pattern.slice(schemeSplit + 3).split('/')[0] ?? '';
      if (hostMatchesWildcard(parsed.hostname, hostPattern)) {
        return true;
      }
      continue;
    }

    if (pattern.startsWith('*.') && parsed.protocol === 'https:') {
      if (hostMatchesWildcard(parsed.hostname, pattern)) {
        return true;
      }
    }
  }

  return false;
}
