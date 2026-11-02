import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export interface ReleaseBinding {
  repository: string;
  catalogSha256: string;
  publishAt: string;
}
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
      .join(',')}}`;
  return JSON.stringify(value);
};
const context = (binding: ReleaseBinding) =>
  Buffer.from(canonical({ purpose: 'nur-sermon-release-v1', ...binding }));
function keyBytes(key: string): Buffer {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Invalid release key.');
  return Buffer.from(key, 'hex');
}
const subkey = (key: string, purpose: string, binding: ReleaseBinding) =>
  Buffer.from(hkdfSync('sha256', keyBytes(key), context(binding), purpose, 32));
export const newReleaseKey = () => randomBytes(32).toString('hex');
/** Authenticated encryption of only the validated public-shaped catalog, never review wrappers. */
export function encryptCatalog(
  catalog: unknown,
  key: string,
  binding: ReleaseBinding,
): string {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', subkey(key, 'catalog', binding), iv);
  cipher.setAAD(context(binding));
  const encrypted = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify(catalog)))),
    cipher.final(),
  ]);
  const envelope = JSON.stringify({
    version: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: encrypted.toString('base64'),
  });
  if (Buffer.byteLength(envelope) > 47 * 1024)
    throw new Error('Encrypted payload exceeds the environment-secret budget.');
  return envelope;
}
export function decryptCatalog(
  payload: string,
  key: string,
  binding: ReleaseBinding,
): unknown {
  try {
    if (Buffer.byteLength(payload) > 47 * 1024) throw new Error();
    const data = JSON.parse(payload);
    if (
      data.version !== 1 ||
      Object.keys(data).sort().join(',') !== 'ciphertext,iv,tag,version'
    )
      throw new Error();
    const iv = Buffer.from(data.iv, 'base64'),
      tag = Buffer.from(data.tag, 'base64');
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      subkey(key, 'catalog', binding),
      iv,
    );
    decipher.setAAD(context(binding));
    decipher.setAuthTag(tag);
    const compressed = Buffer.concat([
      decipher.update(Buffer.from(data.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(
      gunzipSync(compressed, { maxOutputLength: 256 * 1024 }).toString('utf8'),
    );
  } catch {
    throw new Error('Encrypted release payload could not be authenticated.');
  }
}
export function signReceipt<T extends object>(
  body: T,
  key: string,
  binding: ReleaseBinding,
) {
  return {
    ...body,
    mac: createHmac('sha256', subkey(key, 'public-receipt', binding))
      .update(canonical(body))
      .digest('hex'),
  };
}
export function verifyReceiptSeal(
  value: Record<string, unknown>,
  key: string,
  binding: ReleaseBinding,
): boolean {
  try {
    const { mac, ...body } = value;
    if (typeof mac !== 'string' || !/^[0-9a-f]{64}$/.test(mac)) return false;
    return timingSafeEqual(
      Buffer.from(mac, 'hex'),
      Buffer.from(signReceipt(body, key, binding).mac, 'hex'),
    );
  } catch {
    return false;
  }
}
