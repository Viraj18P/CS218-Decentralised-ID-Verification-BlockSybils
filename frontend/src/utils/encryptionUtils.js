/**
 * @file encryptionUtils.js
 * @description Hybrid encryption utilities
 * AES-256-GCM for file + MetaMask asymmetric encryption for AES key
 */

import { ethers } from "ethers";
import { bufferToHex } from "ethereumjs-util";
import { encrypt } from "@metamask/eth-sig-util";

/**
 * Generate random AES-256 key
 */
export async function generateAESKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Export AES key to raw bytes
 */
export async function exportAESKey(key) {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return new Uint8Array(exported);
}

/**
 * Import AES key from raw bytes
 */
export async function importAESKey(keyBytes) {
  return await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt file with AES-256-GCM
 */
export async function encryptFileWithAES(fileData, aesKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    fileData
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
}

/**
 * Decrypt file with AES-256-GCM
 */
export async function decryptFileWithAES(ciphertext, iv, aesKey) {
  return await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );
}

/**
 * Get MetaMask encryption public key
 */
export async function getEncryptionPublicKey(address) {
  return await window.ethereum.request({
    method: "eth_getEncryptionPublicKey",
    params: [address],
  });
}

/**
 * Encrypt AES key using MetaMask public key
 */
export async function encryptAESKeyWithPublicKey(aesKeyBytes, publicKey) {
  const encrypted = encrypt({
    publicKey: publicKey,
    data: bufferToHex(aesKeyBytes),
    version: "x25519-xsalsa20-poly1305",
  });

  return JSON.stringify(encrypted);
}

/**
 * Decrypt AES key using MetaMask (private key stays in wallet)
 */
export async function decryptAESKeyWithPrivateKey(encryptedKey, address) {
  const decrypted = await window.ethereum.request({
    method: "eth_decrypt",
    params: [encryptedKey, address],
  });

  return new Uint8Array(Buffer.from(decrypted.slice(2), "hex"));
}

/**
 * Compute keccak256 hash of file
 */
export async function computeFileHash(fileData) {
  const bytes = new Uint8Array(fileData);
  return ethers.keccak256(bytes);
}

/**
 * Create encrypted package for IPFS
 */
export function createEncryptedPackage(
  ciphertext,
  iv,
  encryptedAESKey,
  filename
) {
  return {
    version: "1.0",
    encryption: "AES-256-GCM + MetaMask asymmetric encryption",
    ciphertext: Array.from(ciphertext),
    iv: Array.from(iv),
    encryptedAESKey,
    filename,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Extract encryption materials from IPFS package
 */
export function extractEncryptionMaterials(ipfsPackage) {
  return {
    ciphertext: new Uint8Array(ipfsPackage.ciphertext),
    iv: new Uint8Array(ipfsPackage.iv),
    encryptedAESKey: ipfsPackage.encryptedAESKey,
    filename: ipfsPackage.filename,
  };
}

/**
 * Full encryption flow
 */
export async function encryptDocumentForVerifier(
  fileData,
  verifierAddress,
  filename
) {
  // 1. Generate AES key
  const aesKey = await generateAESKey();

  // 2. Encrypt file
  const { ciphertext, iv } = await encryptFileWithAES(fileData, aesKey);

  // 3. Export AES key
  const aesKeyBytes = await exportAESKey(aesKey);

  // 4. Get verifier public key
  const publicKey = await getEncryptionPublicKey(verifierAddress);

  // 5. Encrypt AES key
  const encryptedAESKey = await encryptAESKeyWithPublicKey(
    aesKeyBytes,
    publicKey
  );

  // 6. Compute hash
  const documentHash = await computeFileHash(fileData);

  // 7. Create package
  const packageJson = createEncryptedPackage(
    ciphertext,
    iv,
    encryptedAESKey,
    filename
  );

  return { packageJson, documentHash };
}

/**
 * Full decryption flow (Verifier side)
 */
export async function decryptDocumentAsVerifier(
  ipfsPackage,
  verifierAddress
) {
  const { ciphertext, iv, encryptedAESKey, filename } =
    extractEncryptionMaterials(ipfsPackage);

  // 1. Decrypt AES key via MetaMask
  const aesKeyBytes = await decryptAESKeyWithPrivateKey(
    encryptedAESKey,
    verifierAddress
  );

  // 2. Import AES key
  const aesKey = await importAESKey(aesKeyBytes);

  // 3. Decrypt file
  const fileData = await decryptFileWithAES(ciphertext, iv, aesKey);

  return { fileData, filename };
}

/**
 * Verify integrity
 */
export async function verifyDocumentIntegrity(fileData, expectedHash) {
  const computedHash = await computeFileHash(fileData);
  return computedHash.toLowerCase() === expectedHash.toLowerCase();
}