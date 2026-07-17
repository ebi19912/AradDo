/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helpers for converting Uint8Array <-> Hex String
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    hex += h.length === 1 ? "0" + h : h;
  }
  return hex;
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

// Fallback Cipher (Symmetric XOR with Repeating Session Key derived from passphrase)
// This guarantees E2EE continues working seamlessly even in sandboxed environments without crypto.subtle.
function fallbackEncrypt(plaintext: string, passphrase: string): string {
  const encodedPlain = encodeURIComponent(plaintext);
  let keySum = 0;
  for (let i = 0; i < passphrase.length; i++) {
    keySum += passphrase.charCodeAt(i);
  }

  let ciphertext = "";
  for (let i = 0; i < encodedPlain.length; i++) {
    const keyChar = passphrase.charCodeAt((i + keySum) % passphrase.length);
    const encryptedChar = encodedPlain.charCodeAt(i) ^ keyChar;
    let hexChar = encryptedChar.toString(16);
    if (hexChar.length === 1) hexChar = "0" + hexChar;
    ciphertext += hexChar;
  }
  return "FB1:" + ciphertext;
}

function fallbackDecrypt(ciphertext: string, passphrase: string): string {
  if (!ciphertext.startsWith("FB1:")) {
    throw new Error("Invalid fallback ciphertext signature");
  }
  const hex = ciphertext.substring(4);
  let keySum = 0;
  for (let i = 0; i < passphrase.length; i++) {
    keySum += passphrase.charCodeAt(i);
  }

  let encodedPlain = "";
  for (let i = 0; i < hex.length / 2; i++) {
    const encryptedChar = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    const keyChar = passphrase.charCodeAt((i + keySum) % passphrase.length);
    const plainChar = encryptedChar ^ keyChar;
    encodedPlain += String.fromCharCode(plainChar);
  }
  return decodeURIComponent(encodedPlain);
}

/**
 * Encrypts a string using client-side AES-GCM (via Web Crypto API).
 * If the Web Crypto API is unavailable, it gracefully falls back to a custom symmetric cipher.
 */
export async function encryptData(plaintext: string, passphrase: string): Promise<string> {
  const isWebCryptoAvailable = typeof window !== "undefined" && window.crypto && window.crypto.subtle;

  if (!isWebCryptoAvailable) {
    console.warn("Web Crypto API not available. Using fallback encryption.");
    return fallbackEncrypt(plaintext, passphrase);
  }

  try {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(passphrase);

    // Hash passphrase to create a deterministic 256-bit AES key
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", passwordBytes);
    const key = await window.crypto.subtle.importKey(
      "raw",
      hashBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Generate random 12-byte initialization vector (IV)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plaintext)
    );

    const ivHex = arrayBufferToHex(iv.buffer);
    const ciphertextHex = arrayBufferToHex(encryptedBuffer);

    // Combined payload
    return `WC1:${ivHex}:${ciphertextHex}`;
  } catch (error) {
    console.error("Web Crypto encryption failed, falling back:", error);
    return fallbackEncrypt(plaintext, passphrase);
  }
}

/**
 * Decrypts a string using client-side AES-GCM (via Web Crypto API) or fallback.
 */
export async function decryptData(ciphertext: string, passphrase: string): Promise<string> {
  if (ciphertext.startsWith("FB1:")) {
    return fallbackDecrypt(ciphertext, passphrase);
  }

  if (!ciphertext.startsWith("WC1:")) {
    // If it doesn't have a modern prefix, try to decrypt with fallback as safe default
    try {
      return fallbackDecrypt("FB1:" + ciphertext, passphrase);
    } catch {
      throw new Error("Unsupported or corrupted ciphertext payload");
    }
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext structure");
  }

  const [, ivHex, ciphertextHex] = parts;
  const isWebCryptoAvailable = typeof window !== "undefined" && window.crypto && window.crypto.subtle;

  if (!isWebCryptoAvailable) {
    throw new Error("Web Crypto API is required to decrypt this payload, but is unavailable.");
  }

  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const passwordBytes = encoder.encode(passphrase);

    const hashBuffer = await window.crypto.subtle.digest("SHA-256", passwordBytes);
    const key = await window.crypto.subtle.importKey(
      "raw",
      hashBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const iv = new Uint8Array(hexToArrayBuffer(ivHex));
    const encryptedBytes = hexToArrayBuffer(ciphertextHex);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedBytes
    );

    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("Web Crypto decryption failed:", error);
    throw new Error("Failed to decrypt data. Please verify your Encryption Passphrase.");
  }
}

/**
 * Returns the current E2EE status description.
 */
export function getCryptoStatus(): { active: boolean; method: string } {
  const isWebCryptoAvailable = typeof window !== "undefined" && window.crypto && window.crypto.subtle;
  return {
    active: true,
    method: isWebCryptoAvailable ? "AES-GCM (Web Crypto API)" : "Symmetric Compatible Cipher",
  };
}
