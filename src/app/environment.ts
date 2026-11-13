const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

/**
 * The destructive local reset is intentionally visible only in local/test
 * contexts. It is never shown on a deployed production host by default.
 *
 * Set VITE_ENABLE_LOCAL_TOOLS=true for a non-local test deployment, or
 * VITE_ENABLE_LOCAL_TOOLS=false to hide it even on localhost.
 */
export function isLocalTestToolsEnabled(): boolean {
  const explicitFlag = import.meta.env.VITE_ENABLE_LOCAL_TOOLS;

  if (explicitFlag === 'true') {
    return true;
  }
  if (explicitFlag === 'false') {
    return false;
  }
  if (import.meta.env.DEV) {
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }

  return LOCAL_HOSTNAMES.has(window.location.hostname.toLowerCase());
}
