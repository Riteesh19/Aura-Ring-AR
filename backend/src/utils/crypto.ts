import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Ensure key is exactly 32 bytes (256 bits)
const getCryptoKey = (): Buffer => {
  const secret = process.env.CRYPTO_SECRET;
  if (!secret) {
    throw new Error('CRYPTO_SECRET is not defined in environment variables.');
  }
  
  // If secret is in hex format and is 64 characters long (representing 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  // Otherwise, hash the secret to get a consistent 32-byte key
  return crypto.createHash('sha256').update(secret).digest();
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a string using AES-256-GCM.
 * @param text Cleartext string to encrypt.
 * @returns Object containing encryptedData, iv, and authTag (all hex-encoded).
 */
export function encrypt(text: string): EncryptedPayload {
  try {
    const key = getCryptoKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${(error as Error).message}`);
  }
}

/**
 * Decrypts a ciphertext using AES-256-GCM.
 * @param encryptedData Hex-encoded encrypted data.
 * @param iv Hex-encoded initialization vector.
 * @param authTag Hex-encoded authentication tag.
 * @returns Decrypted cleartext string.
 */
export function decrypt(encryptedData: string, iv: string, authTag: string): string {
  try {
    const key = getCryptoKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${(error as Error).message}`);
  }
}
