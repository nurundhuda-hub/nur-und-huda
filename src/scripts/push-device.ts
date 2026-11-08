const KEY = 'nur-push-device-v1';
export function pushDevice(create = false): string | null {
  try {
    let value = localStorage.getItem(KEY);
    if (value && /^[A-Za-z0-9_-]{43}$/.test(value)) return value;
    if (!create) return null;
    value = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    localStorage.setItem(KEY, value);
    return value;
  } catch {
    return null;
  }
}
