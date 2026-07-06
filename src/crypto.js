export async function deriveKey(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBuffer(buffer, pin) {
  if (!pin) throw new Error("PIN is required for encryption");
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    buffer
  );
  
  const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(ciphertext), salt.length + iv.length);
  
  return result.buffer; 
}

export async function decryptBuffer(encryptedBuffer, pin) {
  if (!pin) throw new Error("PIN is required for decryption");
  const data = new Uint8Array(encryptedBuffer);
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);
  
  const key = await deriveKey(pin, salt);
  
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );
  
  return plaintext; 
}
