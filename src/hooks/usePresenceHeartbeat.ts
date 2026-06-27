import { useEffect } from 'react';
import { startPresenceHeartbeat } from '../lib/presenceClient';

/** Register browser presence for admin session tracking (all visitors). */
export function usePresenceHeartbeat(): void {
  useEffect(() => startPresenceHeartbeat(), []);
}
