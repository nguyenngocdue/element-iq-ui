export function loginPath(returnTo?: string): string {
  const target =
    returnTo ??
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/');
  return `/login?returnTo=${encodeURIComponent(target)}`;
}
