/**
 * @file cryptoUtils.js
 * @description End-to-end encryption using verifier's Ethereum keypair.
 *
 * FIXED: fetchAndDecrypt — AES key reconstruction from eth_decrypt was wrong.
 * MetaMask eth_decrypt returns the nacl box plaintext as a string.
 * The original AES key was stored as raw bytes inside the nacl box.
 * We must use TextEncoder to convert back to Uint8Array, not charCodeAt.
 */

// ─── Base64 helpers ────────────────────────────────────────────────────────────
export function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export function base64ToBuf(b64) {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out.buffer
}

// ─── Step 1: Get verifier's encryption public key via MetaMask ─────────────────
export async function getEncryptionPublicKey(address) {
  return window.ethereum.request({
    method: 'eth_getEncryptionPublicKey',
    params: [address],
  })
}

// ─── AES-256-GCM file encryption ─────────────────────────────────────────────
async function makeAESKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

async function exportRawAES(key) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

async function importRawAES(raw) {
  return crypto.subtle.importKey(
    'raw',
    raw instanceof Uint8Array ? raw : new Uint8Array(raw),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
}

async function aesEncrypt(file) {
  const key       = await makeAESKey()
  const iv        = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = await file.arrayBuffer()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    encryptedBytes: new Uint8Array(ciphertext),
    aesKeyRaw:      await exportRawAES(key),
    iv,
  }
}

async function aesDecrypt(encryptedBytes, aesKeyRaw, ivB64) {
  const key   = await importRawAES(aesKeyRaw)
  const iv    = new Uint8Array(base64ToBuf(ivB64))
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes instanceof Uint8Array ? encryptedBytes : new Uint8Array(encryptedBytes)
  )
  return new Uint8Array(plain)
}

// ─── Wrap AES key with verifier's Ethereum public key (nacl box) ──────────────
export async function encryptAESKeyForVerifier(aesKeyRaw, verifierPubKeyB64) {
  const [nacl, naclUtil] = await Promise.all([
    import('tweetnacl'),
    import('tweetnacl-util'),
  ])

  const ephemeralKeypair = nacl.default.box.keyPair()
  const verifierPubKey   = naclUtil.decodeBase64(verifierPubKeyB64)
  const nonce            = nacl.default.randomBytes(nacl.default.box.nonceLength)

  // Store AES key as base64 string inside the nacl box
  // This way MetaMask's eth_decrypt returns a base64 string we can reliably decode
  const aesKeyB64    = bufToBase64(aesKeyRaw)
  const messageBytes = new TextEncoder().encode(aesKeyB64)
  const encrypted    = nacl.default.box(messageBytes, nonce, verifierPubKey, ephemeralKeypair.secretKey)

  return JSON.stringify({
    version:        'x25519-xsalsa20-poly1305',
    nonce:          naclUtil.encodeBase64(nonce),
    ephemPublicKey: naclUtil.encodeBase64(ephemeralKeypair.publicKey),
    ciphertext:     naclUtil.encodeBase64(encrypted),
  })
}

// ─── Upload encrypted blob to IPFS ───────────────────────────────────────────
export async function uploadEncryptedToIPFS(encryptedBytes, originalFilename, pinataApiKey, pinataApiSecret) {
  const blob = new Blob([encryptedBytes], { type: 'application/octet-stream' })
  const form = new FormData()
  form.append('file', blob, originalFilename + '.enc')

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      pinata_api_key:        pinataApiKey,
      pinata_secret_api_key: pinataApiSecret,
    },
    body: form,
  })
  if (!res.ok) throw new Error('IPFS upload failed: ' + (await res.text()))
  return (await res.json()).IpfsHash
}

export async function uploadPlainToIPFS(file, pinataApiKey, pinataApiSecret) {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      pinata_api_key:        pinataApiKey,
      pinata_secret_api_key: pinataApiSecret,
    },
    body: form,
  })
  if (!res.ok) throw new Error('IPFS upload failed: ' + (await res.text()))
  return (await res.json()).IpfsHash
}

// ─── Full encrypt + upload pipeline ──────────────────────────────────────────
export async function encryptAndUpload(file, verifierPubKeyB64, pinataApiKey, pinataApiSecret) {
  const { encryptedBytes, aesKeyRaw, iv } = await aesEncrypt(file)
  const encryptedKeyJson = await encryptAESKeyForVerifier(aesKeyRaw, verifierPubKeyB64)
  const ipfsCid = await uploadEncryptedToIPFS(encryptedBytes, file.name, pinataApiKey, pinataApiSecret)
  return { ipfsCid, encryptedKeyJson, ivB64: bufToBase64(iv) }
}

// ─── Verifier: decrypt with MetaMask eth_decrypt ─────────────────────────────
export async function fetchAndDecrypt(ipfsCid, encryptedKeyJson, ivB64, verifierAddress) {
  // 1. Fetch encrypted blob from IPFS
  const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCid}`)
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.statusText}`)
  const encryptedBytes = new Uint8Array(await res.arrayBuffer())

  // 2. eth_decrypt — MetaMask decrypts the nacl box using verifier's private key
  //    Payload must be hex-encoded UTF-8 of the JSON string
  const hexPayload = '0x' + Array.from(new TextEncoder().encode(encryptedKeyJson))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const decryptedStr = await window.ethereum.request({
    method: 'eth_decrypt',
    params: [hexPayload, verifierAddress],
  })

  // 3. MetaMask returns the plaintext as a string.
  //    We encoded the AES key as base64 before boxing it (in encryptAESKeyForVerifier).
  //    So decryptedStr is a base64 string — decode it back to raw bytes.
  // MetaMask eth_decrypt returns a string.
  // We try multiple decoding strategies to handle both old and new registrations.
  let aesKeyRaw = null

  // Strategy 1: new registrations — AES key was base64-encoded before boxing
  try {
    const candidate = new Uint8Array(base64ToBuf(decryptedStr))
    if (candidate.length === 16 || candidate.length === 32) {
      aesKeyRaw = candidate
    }
  } catch { /* not base64 */ }

  // Strategy 2: MetaMask returns Buffer.toString() which uses UTF-8.
  // For old registrations where raw bytes were boxed directly,
  // recover using latin1 (1:1 char→byte mapping, no loss unlike UTF-8)
  if (!aesKeyRaw) {
    try {
      // In browser: encode each char as its char code (latin1-compatible)
      const candidate = new Uint8Array(
        Array.from(decryptedStr).map(c => c.charCodeAt(0) & 0xff)
      )
      if (candidate.length === 16 || candidate.length === 32) {
        aesKeyRaw = candidate
      }
    } catch { /* failed */ }
  }

  // Strategy 3: hex string
  if (!aesKeyRaw && /^[0-9a-fA-F]+$/.test(decryptedStr) && decryptedStr.length % 2 === 0) {
    try {
      const bytes = decryptedStr.match(/.{2}/g).map(h => parseInt(h, 16))
      const candidate = new Uint8Array(bytes)
      if (candidate.length === 16 || candidate.length === 32) {
        aesKeyRaw = candidate
      }
    } catch { /* not hex */ }
  }

  if (!aesKeyRaw) {
    throw new Error(
      `Could not recover AES key from MetaMask response (${decryptedStr.length} chars). ` +
      `Please re-register your document — this fixes the encryption format.`
    )
  }

  // 4. Decrypt the file locally with the recovered AES key
  return aesDecrypt(encryptedBytes, aesKeyRaw, ivB64)
}

// ─── Verifier pubkey cache (localStorage) ────────────────────────────────────
const LS_KEY = 'blocksybils_pubkeys'

export function getCachedPubKey(address) {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}')[address.toLowerCase()] || null
  } catch { return null }
}

export function cachePubKey(address, pubKey) {
  try {
    const map = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    map[address.toLowerCase()] = pubKey
    localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch {}
}

// ─── Filename metadata encoding ───────────────────────────────────────────────
// Encodes encryption metadata into the filename field on-chain.
// Format: "document.pdf|ENC:{"k":"<encryptedKeyJson>","i":"<ivB64>"}"
// No contract change needed.

export function encodeFilename(filename, encryptedKeyJson, ivB64) {
  return `${filename}|ENC:${JSON.stringify({ k: encryptedKeyJson, i: ivB64 })}`
}

export function decodeFilename(raw) {
  const sep = raw ? raw.lastIndexOf('|ENC:') : -1
  if (sep === -1) return { filename: raw || '', encryptedKeyJson: null, ivB64: null, isEncrypted: false }
  try {
    const meta = JSON.parse(raw.slice(sep + 5))
    return { filename: raw.slice(0, sep), encryptedKeyJson: meta.k, ivB64: meta.i, isEncrypted: true }
  } catch {
    return { filename: raw, encryptedKeyJson: null, ivB64: null, isEncrypted: false }
  }
}