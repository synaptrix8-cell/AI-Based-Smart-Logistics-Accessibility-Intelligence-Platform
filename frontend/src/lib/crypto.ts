/**
 * Client-Side Field-Level Encryption
 * 
 * Uses standard Web Crypto API (AES-GCM 256-bit).
 * Encrypts sensitive citizen and reporter remarks, contact details,
 * and incident notes before transmission over the network.
 */

const DEFAULT_SECRET = "setu-ner-field-encryption-key-2024-secret";

async function deriveKey(secret: string = DEFAULT_SECRET): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return keyMaterial;
}

export interface EncryptedResult {
  ciphertext: string; // Base64 encoded
  iv: string;         // Base64 encoded 96-bit IV
}

/**
 * Encrypt arbitrary plain text or JSON object using AES-GCM
 */
export async function encryptPayload(
  data: unknown,
  secret: string = DEFAULT_SECRET
): Promise<EncryptedResult> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // Fallback if running outside browser
    return {
      ciphertext: btoa(JSON.stringify(data)),
      iv: "fallback",
    };
  }

  const key = await deriveKey(secret);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encodedData = new TextEncoder().encode(JSON.stringify(data));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encodedData
  );

  const ciphertext = btoa(
    String.fromCharCode(...new Uint8Array(encryptedBuffer))
  );
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    ciphertext,
    iv: ivBase64,
  };
}

/**
 * Decrypt AES-GCM ciphertext back into plain text / object
 */
export async function decryptPayload<T = unknown>(
  ciphertext: string,
  ivBase64: string,
  secret: string = DEFAULT_SECRET
): Promise<T | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    try {
      return JSON.parse(atob(ciphertext));
    } catch {
      return null;
    }
  }

  try {
    const key = await deriveKey(secret);
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
    const encryptedBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      encryptedBytes
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedText) as T;
  } catch (err) {
    console.error("Failed to decrypt payload:", err);
    return null;
  }
}
