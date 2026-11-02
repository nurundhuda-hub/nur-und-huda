export const retryUntil = '2026-11-09T00:00:00Z';
export function automaticGate(
  input: {
    repository: string;
    ref: string;
    enabled: string;
    mode: string;
    scheduled: boolean;
    now: number;
  },
  publishAt: string,
) {
  if (
    input.repository !== 'nurundhuda-hub/nur-und-huda' ||
    input.ref !== 'refs/heads/main'
  )
    return 'wrong-source';
  if (input.mode !== 'release') return 'preflight-only';
  if (input.enabled !== 'true') return 'disabled';
  if (
    !Number.isFinite(input.now) ||
    !Number.isFinite(Date.parse(publishAt)) ||
    input.now < Date.parse(publishAt)
  )
    return 'embargo';
  if (input.scheduled && input.now >= Date.parse(retryUntil))
    return 'retry-window-ended';
  return 'due';
}
