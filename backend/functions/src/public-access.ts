import { ApiError } from './core.js';

/** Activation is configuration, never a credential supplied by a visitor. */
export function requirePublicAccess(enabled: unknown): void {
  if (enabled !== true) throw new ApiError(503, 'UNAVAILABLE');
}
