// Authentication utilities for password hashing and verification
// Using Web Crypto API compatible with Cloudflare Workers

// Simple password hashing using Web Crypto API
// In production, consider using a more robust solution like Argon2
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Add a salt (in production, use a random salt per password)
  const salt = 'mobilize-salt-2024';
  const saltedPassword = password + salt;
  const saltedData = encoder.encode(saltedPassword);
  const saltedHashBuffer = await crypto.subtle.digest('SHA-256', saltedData);
  const saltedHashArray = Array.from(new Uint8Array(saltedHashBuffer));
  const saltedHashHex = saltedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return saltedHashHex;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  
  // Use timing-safe comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(passwordHash);
  const hashBuffer = encoder.encode(hash);
  
  if (passwordBuffer.length !== hashBuffer.length) {
    return false;
  }
  
  // Simple timing-safe comparison
  let result = 0;
  for (let i = 0; i < passwordBuffer.length; i++) {
    result |= passwordBuffer[i] ^ hashBuffer[i];
  }
  
  return result === 0;
}

// Helper function to extract user ID from JWT payload
export function getUserIdFromPayload(payload: any): string | null {
  return payload?.userId || null;
}
