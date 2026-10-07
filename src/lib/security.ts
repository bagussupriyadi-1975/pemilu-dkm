/**
 * Module Keamanan & Kriptografi E-Pilketos / E-Pilkosim
 * Memastikan proteksi data, tokenisasi PIN pemilih, dan hashing standar SHA-256.
 */

// Karakter acak yang mudah dibaca, menghindari ambiguitas (tanpa I, l, 0, O)
const SAFE_PIN_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Menghasilkan PIN acak 6 karakter unik untuk otentikasi siswa
 */
export function generateRandomPin(length = 6): string {
  let result = '';
  const cryptoObj = window.crypto || (window as unknown as { msCrypto: Crypto }).msCrypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const randomValues = new Uint32Array(length);
    cryptoObj.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += SAFE_PIN_CHARS[randomValues[i] % SAFE_PIN_CHARS.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += SAFE_PIN_CHARS.charAt(Math.floor(Math.random() * SAFE_PIN_CHARS.length));
    }
  }
  return result;
}

/**
 * Hash SHA-256 untuk PIN pemilih agar tidak tersimpan mentah dalam sistem produksi
 */
export async function sha256(message: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(message.toUpperCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback pseudo-hash jika Web Crypto tidak tersedia pada runtime khusus
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Verifikasi PIN yang diinput siswa
 */
export async function verifyPin(inputPin: string, storedHash: string): Promise<boolean> {
  if (!inputPin || !storedHash) return false;
  const computed = await sha256(inputPin);
  return computed.toLowerCase() === storedHash.toLowerCase();
}

/**
 * Validasi format NISN (10 digit numerik)
 */
export function validateNISN(nisn: string): boolean {
  return /^[0-9]{10}$/.test(nisn.trim());
}
