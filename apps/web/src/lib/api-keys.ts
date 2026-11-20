import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Merchant API keys.
 *  - public key  pk_live_…  not secret, identifies the business
 *  - secret key  sk_live_…  sent as "Authorization: Bearer sk_live_…"
 * The database keeps a SHA-256 hash of the secret (to check requests) and an AES-256-GCM encrypted
 * copy (so owners can View/Copy it again, like Paymob). The encryption key is derived from the
 * server's SUPABASE_SERVICE_ROLE_KEY, which the database never sees: a database leak alone can't reveal secrets.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomToken(len: number): string {
  const bytes = randomBytes(len * 2);
  let out = "";
  for (let i = 0; out.length < len && i < bytes.length; i++) if (bytes[i] < 248) out += ALPHABET[bytes[i] % 62];
  return out.length === len ? out : randomToken(len);
}
export const newPublicKey = () => `pk_live_${randomToken(32)}`;
export const newSecretKey = () => `sk_live_${randomToken(48)}`;
export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

function encKey() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createHash("sha256").update(`perkly-api-keys:v1:${k}`).digest();
}
export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}
export function decryptSecret(enc: string) {
  const [v, iv, tag, data] = enc.split(".");
  if (v !== "v1") throw new Error("unknown key format");
  const d = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
export const mask = (key: string) => `${key.slice(0, 12)}${"•".repeat(12)}${key.slice(-4)}`;
