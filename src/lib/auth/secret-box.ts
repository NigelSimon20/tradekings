/**
 * Seals a secret (such as a Google refresh token) so it can be kept in the
 * spreadsheet: AES-GCM with a key derived from AUTH_SECRET. Anyone who can
 * open the sheet sees only ciphertext; changing AUTH_SECRET makes old values
 * unreadable, which simply means connecting again.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function keyFor(secret: string, purpose: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(`${purpose}\u0000${secret}`));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export async function seal(plaintext: string, secret: string, purpose: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await keyFor(secret, purpose),
    encoder.encode(plaintext),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/** The original text, or null when the value was tampered with or sealed with another key. */
export async function unseal(sealed: string, secret: string, purpose: string): Promise<string | null> {
  const [version, iv, ciphertext] = sealed.split(".");
  if (version !== "v1" || !iv || !ciphertext) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
      await keyFor(secret, purpose),
      Buffer.from(ciphertext, "base64url"),
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}
