/**
 * Encryption utilities for sensitive credentials
 * Uses AES-256-GCM for secure encryption/decryption
 */

// Convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to base64
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

// Convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// Get encryption key from environment
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('ENCRYPTION_KEY not configured');
  }
  
  // Hash the key to get consistent 256-bit key
  const keyData = stringToUint8Array(keyString);
  const hash = await crypto.subtle.digest('SHA-256', keyData);
  
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string
 * Returns base64-encoded encrypted data with IV prepended
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const data = stringToUint8Array(plaintext);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return uint8ArrayToBase64(combined);
}

/**
 * Decrypt an encrypted string
 * Expects base64-encoded data with IV prepended
 */
export async function decrypt(encryptedData: string): Promise<string> {
  if (!encryptedData) return '';
  
  const key = await getEncryptionKey();
  const combined = base64ToUint8Array(encryptedData);
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Safely decrypt with fallback to plaintext for backward compatibility
 * If decryption fails, assumes the value is plaintext (not yet encrypted)
 */
export async function safeDecrypt(value: string | null): Promise<string> {
  if (!value) return '';
  
  try {
    return await decrypt(value);
  } catch (error) {
    // If decryption fails, assume it's plaintext (backward compatibility)
    console.warn('Decryption failed, assuming plaintext:', error);
    return value;
  }
}
