/** Reject the whole configuration on malformed/non-HTTPS origins. CORS is not authentication. */
export function allowsOrigin(
  configuration: string,
  requested: string | undefined,
  emulator = false,
): boolean {
  const origins = configuration.split(',').map((value) => value.trim());
  if (!requested || origins.some((value) => !validOrigin(value, emulator)))
    return false;
  return origins.includes(requested);
}

function validOrigin(value: string, emulator: boolean): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (emulator &&
          url.protocol === 'http:' &&
          ['127.0.0.1', 'localhost'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
