/**
 * Encryption utilities for message content
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from "crypto";
import { logger } from "./logger.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (256 bits) in hex format (64 characters)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "MESSAGE_ENCRYPTION_KEY environment variable is not set. " +
        "Generate a 32-byte key with: openssl rand -hex 32"
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      "MESSAGE_ENCRYPTION_KEY must be 64 hex characters (32 bytes). " +
        `Current length: ${keyHex.length}`
    );
  }

  return Buffer.from(keyHex, "hex");
}

export interface EncryptedData {
  encrypted: string; // Hex-encoded ciphertext
  iv: string; // Hex-encoded initialization vector
  tag: string; // Hex-encoded authentication tag
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Object containing encrypted data, IV, and auth tag (all hex-encoded)
 */
export function encrypt(plaintext: string): EncryptedData {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
    };
  } catch (error) {
    logger.error("Encryption error:", error);
    throw new Error("Failed to encrypt message content");
  }
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * @param encrypted - Hex-encoded ciphertext
 * @param iv - Hex-encoded initialization vector
 * @param tag - Hex-encoded authentication tag
 * @returns The decrypted plaintext string
 */
export function decrypt(encrypted: string, iv: string, tag: string): string {
  try {
    const key = getEncryptionKey();
    const ivBuffer = Buffer.from(iv, "hex");
    const tagBuffer = Buffer.from(tag, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error("Decryption error:", error);
    throw new Error("Failed to decrypt message content");
  }
}
