// ----------------------------------------------------------------------
// In-memory CSRF token for the current session.
// Never written to localStorage or sessionStorage: a session cookie carries auth,
// and the CSRF token only needs to survive in memory for the life of the tab.
// ----------------------------------------------------------------------

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token && token.length > 0 ? token : null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

/** Test helper: reset the module-level token between tests. */
export function resetCsrfStore(): void {
  csrfToken = null;
}
