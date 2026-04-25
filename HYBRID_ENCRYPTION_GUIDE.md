# 🔐 Hybrid Encryption & IPFS Integration Guide

## Overview

The decentralized identity verification system now implements **hybrid encryption** for secure document storage and verifier-specific access control.

### ✨ Key Features

- **Hybrid Encryption**: AES-256-GCM for documents + RSA-OAEP for keys
- **IPFS Storage**: Encrypted documents stored on IPFS via Pinata API
- **On-Chain Hash**: Only document hashes stored on-chain (gas efficient)
- **Verifier-Specific Access**: Only assigned verifier can decrypt documents
- **Integrity Verification**: Document hash validation before approval

---

## 🏗️ Architecture

### Smart Contract: `IdentityRegistry`

Updated struct to support IPFS:

```solidity
struct Identity {
    bytes32 documentHash;      // keccak256 hash of original document
    address assignedVerifier;   // Only this verifier can decrypt
    string ipfsCid;            // IPFS CID of encrypted document
    string filename;           // Original filename (metadata)
    bool verified;
    uint256 timestamp;
    uint256 verifiedTimestamp;
}
```

### Updated Functions

```solidity
// Register with hybrid encryption metadata
registerIdentity(
    address verifier,
    bytes32 documentHash,
    string calldata ipfsCid,
    string calldata filename
)

// Only assigned verifier can call
verifyIdentity(address user)

// Retrieve IPFS CID
getIPFSCid(address user) → string
getAssignedVerifier(address user) → address

// Update before verification
updateIPFSCid(string calldata newCid)
```

---

## 📦 Frontend Utilities

### 1. **Encryption Utilities** (`frontend/src/utils/encryptionUtils.js`)

```javascript
// Generate AES key
const aesKey = await generateAESKey();

// Encrypt document with AES-256-GCM
const { ciphertext, iv } = await encryptFileWithAES(fileData, aesKey);

// Encrypt AES key with verifier's public key (RSA-OAEP)
const { encryptedKey } = await encryptAESKeyWithPublicKey(
    aesKeyBytes,
    verifierPublicKey
);

// Compute keccak256 hash
const documentHash = await computeFileHash(fileData);

// Full flow
const { packageJson, documentHash } = await encryptDocumentForVerifier(
    fileData,
    verifierPublicKey,
    filename
);

// Verify integrity
const isValid = await verifyDocumentIntegrity(fileData, expectedHash);

// Decrypt for verification
const { fileData, filename } = await decryptDocumentAsVerifier(
    encryptedPackage,
    verifierPrivateKey
);
```

### 2. **IPFS Utilities** (`frontend/src/utils/ipfsUtils.js`)

```javascript
// Upload encrypted package to IPFS
const cid = await uploadToIPFS(
    encryptedPackage,
    filename,
    pinataApiKey,
    pinataSecretKey
);

// Download from IPFS
const encryptedPackage = await downloadFromIPFS(cid);

// Download with fallback gateways
const encryptedPackage = await downloadFromIPFSWithFallback(cid);

// Test Pinata connection
const connected = await testPinataConnection(apiKey, secretKey);
```

---

## 🔄 Complete Registration Flow

### User: Register Identity with Hybrid Encryption

```javascript
// 1. Select verifier
const verifier = {
    address: "0x742d35Cc6634C0532925a3b844Bc7e7595f42471",
    publicKey: "0x02e1b90a33f3e47f9984adfb99f7e04a9cf8c4dbb0e4b0f3e4c4b9e4d4e4f4e"
};

// 2. Read file
const file = await fileInput.files[0];
const fileData = await file.arrayBuffer();

// 3. Encrypt with hybrid encryption
const { packageJson, documentHash, aesKeyBytes } = 
    await encryptDocumentForVerifier(fileData, verifier.publicKey, file.name);

// 4. Upload encrypted package to IPFS
const cid = await uploadToIPFS(
    packageJson,
    file.name,
    pinataApiKey,
    pinataSecretKey
);

// 5. Store encrypted AES key locally (for demo)
localStorage.setItem(`encrypted-key-${documentHash}`, JSON.stringify({
    documentHash,
    encryptedKey: packageJson.encryptedAESKey,
    filename: file.name
}));

// 6. Call smart contract
const tx = await contract.registerIdentity(
    verifier.address,
    documentHash,    // keccak256 hash
    cid,             // IPFS CID
    file.name
);
```

---

## ✅ Complete Verification Flow

### Verifier: Decrypt & Verify Identity

```javascript
// 1. Get pending identities for verifier
const pending = await contract.getPendingForVerifier(verifierAddress);

// 2. Select identity to verify
const identity = pending[0];

// 3. Download encrypted package from IPFS
const encryptedPackage = await downloadFromIPFSWithFallback(identity.ipfsCid);

// 4. Decrypt document
const { fileData, filename } = await decryptDocumentAsVerifier(
    encryptedPackage,
    verifierPrivateKey  // From secure storage, NOT plaintext
);

// 5. Verify integrity
const isValid = await verifyDocumentIntegrity(
    fileData,
    identity.documentHash
);

if (!isValid) {
    throw new Error("Document hash mismatch!");
}

// 6. Preview document
const text = new TextDecoder().decode(fileData);
console.log("Document preview:", text);

// 7. Approve on-chain
if (isValid) {
    const tx = await contract.verifyIdentity(identity.user);
    await tx.wait();
}
```

---

## 🔐 Security Considerations

### ✅ What's Protected

- **Document confidentiality**: Encrypted end-to-end with AES-256-GCM
- **Key confidentiality**: AES key encrypted with verifier's public key
- **Integrity**: Document hash verified on-chain
- **Access control**: Only assigned verifier can decrypt

### ⚠️ What's NOT Protected (By Design)

- **Metadata**: Filename and IPFS CID are visible on-chain
- **Verifier identity**: It's public that address X is the assigned verifier
- **Timing**: Network analysis could reveal verification activity

### 🔒 Production Recommendations

1. **Private Keys**: Use HSM or secure key management (not localStorage)
2. **Pinata Keys**: Store in environment variables or backend
3. **Backup**: Encrypt and backup private keys securely
4. **Rotation**: Implement key rotation mechanisms

---

## 📝 Event Examples

### Registration Event
```json
{
  "event": "IdentityRegistered",
  "args": {
    "user": "0xUserAddress",
    "verifier": "0xVerifierAddress",
    "documentHash": "0xkeccak256Hash",
    "ipfsCid": "QmXxxx...",
    "filename": "passport.pdf",
    "registeredAt": 1703001234
  }
}
```

### Verification Event
```json
{
  "event": "IdentityVerified",
  "args": {
    "user": "0xUserAddress",
    "verifier": "0xVerifierAddress",
    "verifiedAt": 1703001289
  }
}
```

### IPFS Update Event
```json
{
  "event": "IdentityIPFSUpdated",
  "args": {
    "user": "0xUserAddress",
    "oldCid": "QmOldCid...",
    "newCid": "QmNewCid..."
  }
}
```

---

## 🚀 Usage Examples

### Setup (Frontend)

```javascript
import {
    encryptDocumentForVerifier,
    decryptDocumentAsVerifier,
    verifyDocumentIntegrity
} from './utils/encryptionUtils';

import {
    uploadToIPFS,
    downloadFromIPFSWithFallback,
    testPinataConnection
} from './utils/ipfsUtils';

// Verify Pinata is working
const connected = await testPinataConnection(
    process.env.REACT_APP_PINATA_API_KEY,
    process.env.REACT_APP_PINATA_SECRET_KEY
);
```

### Register (User)

```javascript
// Prepare encryption
const { packageJson, documentHash } = await encryptDocumentForVerifier(
    fileData,
    verifierPublicKey,
    'my_document.pdf'
);

// Upload to IPFS
const cid = await uploadToIPFS(
    packageJson,
    'my_document.pdf',
    PINATA_API_KEY,
    PINATA_SECRET_KEY
);

// Register on-chain
const tx = await identityRegistry.registerIdentity(
    verifierAddress,
    documentHash,
    cid,
    'my_document.pdf'
);
```

### Verify (Verifier)

```javascript
// Get pending identities
const pending = await identityRegistry.getPendingForVerifier(verifierAddress);

// Download and decrypt
const encrypted = await downloadFromIPFSWithFallback(pending[0].ipfsCid);
const { fileData } = await decryptDocumentAsVerifier(
    encrypted,
    VERIFIER_PRIVATE_KEY
);

// Verify integrity
const isValid = await verifyDocumentIntegrity(
    fileData,
    pending[0].documentHash
);

// Approve
if (isValid) {
    const tx = await identityRegistry.verifyIdentity(pending[0].user);
}
```

---

## 📦 Dependencies

**Frontend package.json should include:**

```json
{
  "dependencies": {
    "ethers": "^6.x",
    "eth-crypto": "^2.x",
    "pinata-sdk": "^1.x"
  }
}
```

**Installation:**
```bash
npm install eth-crypto pinata-sdk
```

---

## 🧪 Testing Locally

### Deploy Contract
```bash
forge script scripts/Deploy.s.sol --broadcast
```

### Test Encryption
```javascript
// Create test data
const testDoc = new Uint8Array([1, 2, 3, 4, 5]);
const testVerifierPubKey = "0x02e1b90a...";

// Encrypt
const { packageJson, documentHash } = 
    await encryptDocumentForVerifier(testDoc, testVerifierPubKey, "test.txt");

// Verify encryption happened
console.log("Package:", packageJson.encryption); // "AES-256-GCM + RSA-OAEP"
console.log("Hash:", documentHash);
```

---

## 🐛 Troubleshooting

### Error: "Failed to encrypt AES key"
- Check if public key format is correct (compressed or uncompressed)
- Ensure eth-crypto is installed

### Error: "Failed to download from IPFS"
- Check CID validity: `isValidCID(cid)`
- Try with fallback gateways: `downloadFromIPFSWithFallback(cid)`
- Verify Pinata API keys

### Error: "Document hash mismatch"
- Document was modified after encryption
- Wrong file is being decrypted
- Verify integrity before approving

### Error: "UnauthorizedVerifier"
- Only the assigned verifier can verify
- Check `getAssignedVerifier(userAddress)`

---

## 📖 References

- **AES-256-GCM**: [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- **RSA-OAEP**: [eth-crypto](https://github.com/pubkey/eth-crypto)
- **IPFS**: [Pinata API](https://docs.pinata.cloud/)
- **Solidity**: [IdentityRegistry.sol](../src/IdentityRegistry.sol)

