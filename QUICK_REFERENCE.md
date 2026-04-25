# 🎯 Quick Reference: Hybrid Encryption Integration

## 📋 Files Changed

| File | Changes | Purpose |
|------|---------|---------|
| `src/IdentityRegistry.sol` | +assignedVerifier, +ipfsCid, +filename | Store IPFS reference + verifier |
| `frontend/src/utils/encryptionUtils.js` | ✅ Created | AES-256-GCM + RSA-OAEP encryption |
| `frontend/src/utils/ipfsUtils.js` | ✅ Created | IPFS upload/download via Pinata |
| `scripts/Deploy.s.sol` | Enhanced logging | Better deployment output |
| `frontend/src/abis/IdentityRegistry.json` | Updated | New function signatures |

---

## 🔧 Key Functions to Use

### Encryption

```javascript
// Import
import { 
    encryptDocumentForVerifier, 
    decryptDocumentAsVerifier, 
    verifyDocumentIntegrity 
} from '../utils/encryptionUtils.js';

// Encrypt (User)
const { packageJson, documentHash } = await encryptDocumentForVerifier(
    fileData,           // ArrayBuffer
    verifierPublicKey,  // "0x02..."
    filename            // "document.pdf"
);
// Returns: { packageJson, documentHash, aesKeyBytes }

// Decrypt (Verifier)
const { fileData, filename } = await decryptDocumentAsVerifier(
    encryptedPackage,   // From IPFS
    privateKeyHex       // "0xprivate..."
);
// Returns: { fileData, filename }

// Verify Integrity
const isValid = await verifyDocumentIntegrity(
    decryptedData,      // ArrayBuffer
    expectedHash        // From blockchain
);
// Returns: boolean
```

### IPFS

```javascript
// Import
import { 
    uploadToIPFS, 
    downloadFromIPFSWithFallback, 
    testPinataConnection 
} from '../utils/ipfsUtils.js';

// Upload (User)
const cid = await uploadToIPFS(
    encryptedPackage,   // JSON object
    filename,           // "document.pdf"
    apiKey,             // Pinata key
    secretKey           // Pinata secret
);
// Returns: "QmXxxx..." (IPFS CID)

// Download (Verifier)
const encrypted = await downloadFromIPFSWithFallback(cid);
// Returns: { ciphertext, iv, encryptedAESKey, filename, ... }

// Test Connection
const ok = await testPinataConnection(apiKey, secretKey);
// Returns: true/false
```

### Smart Contract

```javascript
// Import ABI
import RegistryABI from '../abis/IdentityRegistry.json';
import { Contract } from 'ethers';

const contract = new Contract(contractAddress, RegistryABI, signer);

// Register with encryption metadata
await contract.registerIdentity(
    verifierAddress,    // address
    documentHash,       // bytes32 (keccak256)
    ipfsCid,            // string "Qm..."
    filename            // string "doc.pdf"
);

// Verify (only assigned verifier)
await contract.verifyIdentity(userAddress);

// Get IPFS CID
const cid = await contract.getIPFSCid(userAddress);

// Get assigned verifier
const verifier = await contract.getAssignedVerifier(userAddress);
```

---

## 📝 Complete Example: User Registration

```javascript
import { ethers } from 'ethers';
import { encryptDocumentForVerifier } from './utils/encryptionUtils';
import { uploadToIPFS } from './utils/ipfsUtils';
import RegistryABI from './abis/IdentityRegistry.json';

async function registerWithEncryption() {
    // Setup
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
        '0xRegistryAddress',
        RegistryABI,
        signer
    );

    // User inputs
    const file = document.getElementById('fileInput').files[0];
    const verifierAddress = '0x742d35Cc6634C0532925a3b844Bc7e7595f42471';
    const verifierPublicKey = '0x02e1b90a33f3e47f9984adfb99f7e04a9cf8c4dbb...';

    // Step 1: Read file
    const fileData = await file.arrayBuffer();
    console.log('📄 File loaded:', file.name, file.size, 'bytes');

    // Step 2: Encrypt
    console.log('🔐 Encrypting with AES-256-GCM + RSA-OAEP...');
    const { packageJson, documentHash } = await encryptDocumentForVerifier(
        fileData,
        verifierPublicKey,
        file.name
    );
    console.log('✅ Encrypted:', documentHash);

    // Step 3: Upload to IPFS
    console.log('📤 Uploading to IPFS...');
    const cid = await uploadToIPFS(
        packageJson,
        file.name,
        process.env.REACT_APP_PINATA_API_KEY,
        process.env.REACT_APP_PINATA_SECRET_KEY
    );
    console.log('✅ IPFS CID:', cid);

    // Step 4: Store encrypted key locally
    localStorage.setItem(`key-${documentHash}`, JSON.stringify({
        encryptedKey: packageJson.encryptedAESKey,
        filename: file.name
    }));

    // Step 5: Register on-chain
    console.log('⛓️ Registering on-chain...');
    const tx = await contract.registerIdentity(
        verifierAddress,
        documentHash,
        cid,
        file.name
    );
    const receipt = await tx.wait();
    console.log('✅ Registered:', receipt.transactionHash);
}
```

---

## ✅ Complete Example: Verifier Verification

```javascript
import { ethers } from 'ethers';
import { decryptDocumentAsVerifier, verifyDocumentIntegrity } from './utils/encryptionUtils';
import { downloadFromIPFSWithFallback } from './utils/ipfsUtils';
import RegistryABI from './abis/IdentityRegistry.json';

async function verifyIdentity(userAddress) {
    // Setup
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
        '0xRegistryAddress',
        RegistryABI,
        signer
    );

    // Verifier private key (secure storage in production!)
    const privateKey = '0x1234567890abcdef...';

    // Step 1: Get identity details from chain
    console.log('🔍 Fetching identity...');
    const identity = await contract.getIdentity(userAddress);
    console.log('Identity:', {
        hash: identity.documentHash,
        cid: identity.ipfsCid,
        status: identity.status
    });

    // Step 2: Download from IPFS
    console.log('📥 Downloading from IPFS...');
    const encryptedPackage = await downloadFromIPFSWithFallback(identity.ipfsCid);
    console.log('✅ Downloaded');

    // Step 3: Decrypt
    console.log('🔓 Decrypting with private key...');
    const { fileData, filename } = await decryptDocumentAsVerifier(
        encryptedPackage,
        privateKey
    );
    console.log('✅ Decrypted:', filename);

    // Step 4: Verify integrity
    console.log('✔️ Verifying document hash...');
    const isValid = await verifyDocumentIntegrity(
        fileData,
        identity.documentHash
    );
    
    if (!isValid) {
        throw new Error('❌ Document hash mismatch! Possible tampering.');
    }
    console.log('✅ Document verified');

    // Step 5: Preview
    const text = new TextDecoder().decode(fileData);
    console.log('Preview:', text.substring(0, 100) + '...');

    // Step 6: Approve on-chain
    console.log('⛓️ Approving on-chain...');
    const tx = await contract.verifyIdentity(userAddress);
    const receipt = await tx.wait();
    console.log('✅ Approved:', receipt.transactionHash);
}
```

---

## 🔄 Environment Setup

### .env.local (Frontend)
```
REACT_APP_PINATA_API_KEY=<your_pinata_api_key>
REACT_APP_PINATA_SECRET_KEY=<your_pinata_secret_key>
REACT_APP_IDENTITY_REGISTRY=0x<deployed_contract_address>
```

### Install Dependencies
```bash
npm install eth-crypto pinata-sdk ethers
```

---

## 🚀 Integration Checklist

- [ ] Verify `IdentityRegistry.sol` is deployed with new signature
- [ ] Copy `encryptionUtils.js` to `frontend/src/utils/`
- [ ] Copy `ipfsUtils.js` to `frontend/src/utils/`
- [ ] Update `abis/IdentityRegistry.json` with new ABI
- [ ] Update `contracts.js` with new contract address
- [ ] Set Pinata API keys in environment
- [ ] Test user registration flow
- [ ] Test verifier decryption flow
- [ ] Verify document hash matches
- [ ] Test on-chain verification

---

## 💡 Key Concepts

### What Gets Encrypted?
✅ Document (with AES-256-GCM)
✅ AES key (with verifier's public key)

### What Gets Stored On-Chain?
✅ Document hash (keccak256)
✅ IPFS CID
✅ Verifier address

### What Never Gets Stored?
❌ Document content
❌ Encryption keys
❌ Plaintext data

### Who Can Decrypt?
✅ Assigned verifier (with their private key)
❌ Other verifiers
❌ Users
❌ Smart contract

---

## 🐛 Quick Debugging

```javascript
// Check if document hash matches
const hash1 = await computeFileHash(originalData);
const hash2 = await contract.getDocumentHash(userAddress);
console.assert(hash1 === hash2, 'Hash mismatch!');

// Check if IPFS CID is stored
const cid = await contract.getIPFSCid(userAddress);
console.log('Stored CID:', cid);

// Check if you're the assigned verifier
const verifier = await contract.getAssignedVerifier(userAddress);
const myAddress = await signer.getAddress();
console.assert(verifier === myAddress, 'Not assigned verifier!');

// Validate CID format
import { isValidCID } from './utils/ipfsUtils';
console.assert(isValidCID(cid), 'Invalid CID format!');
```

---

## 📖 See Also

- `HYBRID_ENCRYPTION_GUIDE.md` - Full encryption documentation
- `IMPLEMENTATION_SUMMARY.md` - Detailed implementation notes
- `src/IdentityRegistry.sol` - Smart contract code
- `frontend/src/utils/encryptionUtils.js` - Encryption library
- `frontend/src/utils/ipfsUtils.js` - IPFS integration

