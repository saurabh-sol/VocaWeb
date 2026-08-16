import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getSecretKey(): Buffer {
  const secret =
    process.env.INTEGRATION_TOKEN_SECRET ??
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('INTEGRATION_TOKEN_SECRET or JWT_SECRET must be set for token encryption');
  }
  return scryptSync(secret, 'vocaweb-integrations', 32);
}

export function encryptToken(plaintext: string): string {
  const key = getSecretKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptToken(ciphertext: string): string {
  const key = getSecretKey();
  const buf = Buffer.from(ciphertext, 'base64url');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
