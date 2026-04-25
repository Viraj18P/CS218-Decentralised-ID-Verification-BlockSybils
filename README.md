# CS218 — Decentralised Identity Verification
### Team BlockSybils

| Name | Roll Number |
|------|-------------|
| Viraj Samir Patel | 240002079 |
| Subhanshu Kumar | Roll No. |
| Yash Pankaj Choudhary | Roll No. |
| Akarsh Raj | Roll No. |
| Khaled Mohd. Abdul Qader | Roll No. |
| Shlok Parikh | Roll No. |

---

## Project Overview

A fully on-chain decentralised identity verification system built on Ethereum (Sepolia testnet). Users register a keccak256 hash of their identity document. Authorised verifiers approve or revoke identities. A KYC-gated auction demonstrates composability. Documents are AES-256-GCM encrypted in the browser and stored on IPFS — only the assigned verifier can decrypt via MetaMask. Zero-knowledge age proofs are generated in-browser using snarkjs and verified on-chain.

### Architecture

```
Browser (React + ethers.js v6)
    │
    ├── IdentityRegistry.sol     — register, verify, revoke identities
    ├── KYCGatedAuction.sol      — only verified wallets can bid
    ├── ZKGateway.sol            — verifies Groth16 age proofs on-chain
    ├── DIDRegistry.sol          — decentralised identifier registry
    ├── RevocationRegistry.sol   — bitmap-packed credential revocation
    ├── CredentialMetadataRegistry.sol
    └── CredentialVerifier.sol
```

---

## Prerequisites

Install these before starting:

- [Foundry](https://getfoundry.sh/) — Solidity compiler and test framework
- [Node.js](https://nodejs.org/) v18 or higher
- [Git](https://git-scm.com/)
- [MetaMask](https://metamask.io/) browser extension
- A free [Alchemy](https://alchemy.com/) account — for Sepolia RPC URL
- A free [Pinata](https://pinata.cloud/) account — for IPFS document storage

---

## 1. Clone and Install

### Directory: project root
```bash
git clone https://github.com/Viraj18P/CS218-Decentralised-ID-Verification-BlockSybils.git
cd CS218-Decentralised-ID-Verification-BlockSybils
```

### Install Foundry dependencies (OpenZeppelin, forge-std)
### Directory: project root
```bash
forge install
```

### Install circomlib (needed for ZK circuit compilation)
### Directory: project root
```bash
npm install circomlib
```

### Install frontend dependencies
### Directory: frontend/
```bash
cd frontend
npm install
cd ..
```

---

## 2. Environment Setup

### Directory: project root

Create a `.env` file in the project root:
```bash
touch .env
```

Add these lines to `.env` (replace with your real values):
```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=0xYOUR_METAMASK_PRIVATE_KEY
```

Load the environment variables:
```bash
source .env
```

> **Security:** Never commit `.env` to GitHub. It is already listed in `.gitignore`.

---

## 3. Compile Contracts

### Directory: project root
```bash
forge build
```

Expected output: `Compiler run successful`

---

## 4. Run Tests

### Directory: project root

Run all tests with verbose output:
```bash
forge test -vv
```

Run only the rubric-required tests:
```bash
forge test --match-contract RubricTests -vv
```

Run only integration tests:
```bash
forge test --match-contract Integration -vv
```

Expected result: all tests pass, 0 failed.

---

## 5. Coverage Report

### Directory: project root
```bash
forge coverage --report summary
```

Expected result: >= 98% line coverage across all contracts.

---

## 6. Gas Report

### Directory: project root
```bash
forge test --gas-report
```

Paste the output table into your `report.pdf` for the gas optimisation section.

---

## 7. ZK Circuit Setup (run once)

This compiles the age verification circuit and generates the proving/verification keys.
Run these commands inside WSL (Windows Subsystem for Linux).

### Open WSL:
```bash
wsl
```

### Inside WSL — Directory: /mnt/c/Users/YOUR_USERNAME/Blockchain/CS218-Decentralised-ID-Verification-BlockSybils
```bash
# Navigate to project
cd /mnt/c/Users/YOUR_USERNAME/Blockchain/CS218-Decentralised-ID-Verification-BlockSybils

# Install snarkjs globally
npm install -g snarkjs

# Compile the circuit
mkdir -p build/AgeVerifier
circom2 circuits/AgeVerifier.circom --r1cs --wasm --sym -l node_modules -o build/AgeVerifier

# Powers of Tau ceremony (trusted setup)
mkdir -p build/ptau
snarkjs powersoftau new bn128 12 build/ptau/pot12_0000.ptau -v
snarkjs powersoftau contribute build/ptau/pot12_0000.ptau build/ptau/pot12_0001.ptau --name="BlockSybils" -e="blocksybils123"
snarkjs powersoftau prepare phase2 build/ptau/pot12_0001.ptau build/ptau/pot12_final.ptau -v

# Circuit-specific setup
snarkjs groth16 setup build/AgeVerifier/AgeVerifier.r1cs build/ptau/pot12_final.ptau build/AgeVerifier/AgeVerifier_0000.zkey
snarkjs zkey contribute build/AgeVerifier/AgeVerifier_0000.zkey build/AgeVerifier/AgeVerifier_final.zkey --name="dev" -e="entropy123"

# Export verification key and Solidity verifier
snarkjs zkey export verificationkey build/AgeVerifier/AgeVerifier_final.zkey build/AgeVerifier/verification_key.json
snarkjs zkey export solidityverifier build/AgeVerifier/AgeVerifier_final.zkey contracts/verifiers/AgeVerifier.sol

# Copy WASM and zkey to frontend public folder
mkdir -p frontend/public/zk/AgeVerifier
cp build/AgeVerifier/AgeVerifier_js/AgeVerifier.wasm frontend/public/zk/AgeVerifier/
cp build/AgeVerifier/AgeVerifier_final.zkey frontend/public/zk/AgeVerifier/
cp build/AgeVerifier/verification_key.json frontend/public/zk/AgeVerifier/
```

---

## 8. Deploy Contracts to Sepolia

### Directory: project root (Git Bash or WSL)

Make sure `.env` is loaded first:
```bash
source .env
```

Deploy all contracts:
```bash
forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

The terminal will print deployed addresses like:
```
IdentityRegistry:          0xB6A37b4C7688B31E51edc686141D7Dc0Fc6A5520
KYCGatedAuction:           0x380B130A2a8D234b325188Bd342175a98566051a
ZKGateway:                 0x1fa046e287d0637A8F4C3a701Fe3aFA14f5FcFEd
DIDRegistry:               0xE2CD68e9F424BcBcA5Be209B5F0A045D37D6b508
RevocationRegistry:        0x4Ed8Eef7eE228aA254d34A2a29b73703aAa12D0C
CredentialMetadataRegistry:0x86CfD7157bABb65A3Ee979c64f067a600d105De4
CredentialVerifier:        0xa2955E78f0067FEC660c31Ba2aeed57fAd7DD897
```

---

## 9. Update Frontend Contract Addresses

### Directory: frontend/src/

After deployment open `frontend/src/contracts.js` and paste your addresses:
```js
export const CONTRACTS = {
  IDENTITY_REGISTRY:            '0xYour_IdentityRegistry_Address',
  KYC_AUCTION:                  '0xYour_KYCGatedAuction_Address',
  ZK_GATEWAY:                   '0xYour_ZKGateway_Address',
  DID_REGISTRY:                 '0xYour_DIDRegistry_Address',
  REVOCATION_REGISTRY:          '0xYour_RevocationRegistry_Address',
  CREDENTIAL_METADATA_REGISTRY: '0xYour_CredentialMetadataRegistry_Address',
  CREDENTIAL_VERIFIER:          '0xYour_CredentialVerifier_Address',
}

export const REQUIRED_CHAIN_ID = 11155111
export const CHAIN_NAME        = 'Sepolia Testnet'
```

---

## 10. Configure Pinata (IPFS)

Sign up free at [pinata.cloud](https://pinata.cloud) and create an API key.

### Directory: frontend/

Create `frontend/.env`:
```
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_key
```

---

## 11. Run the Frontend

### Directory: frontend/
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Make sure MetaMask is set to **Sepolia test network**.

---

## 12. Build for Production

### Directory: frontend/
```bash
npm run build
```

Built files go to `frontend/dist/`.

Preview the production build:
```bash
npm run preview
```

---

## 13. Deploy Frontend to Vercel (optional)

```bash
# Push all changes to GitHub first
git add .
git commit -m "Final submission"
git push
```

Then go to [vercel.com](https://vercel.com):
1. Import your GitHub repo
2. Set Root Directory to `frontend`
3. Framework: Vite
4. Add environment variables: `VITE_PINATA_API_KEY` and `VITE_PINATA_SECRET_API_KEY`
5. Click Deploy

---

## Contract Addresses (Sepolia Testnet)

| Contract | Address |
|---|---|
| IdentityRegistry | 0xB6A37b4C7688B31E51edc686141D7Dc0Fc6A5520 |
| KYCGatedAuction | 0x380B130A2a8D234b325188Bd342175a98566051a |
| ZKGateway | 0x1fa046e287d0637A8F4C3a701Fe3aFA14f5FcFEd |
| DIDRegistry | 0xE2CD68e9F424BcBcA5Be209B5F0A045D37D6b508 |
| RevocationRegistry | 0x4Ed8Eef7eE228aA254d34A2a29b73703aAa12D0C |
| CredentialMetadataRegistry | 0x86CfD7157bABb65A3Ee979c64f067a600d105De4 |
| CredentialVerifier | 0xa2955E78f0067FEC660c31Ba2aeed57fAd7DD897 |

Verify on Etherscan: [sepolia.etherscan.io](https://sepolia.etherscan.io)

---

## Quick Command Reference

| Task | Directory | Command |
|---|---|---|
| Install Foundry deps | project root | `forge install` |
| Compile contracts | project root | `forge build` |
| Run all tests | project root | `forge test -vv` |
| Run rubric tests | project root | `forge test --match-contract RubricTests -vv` |
| Coverage report | project root | `forge coverage --report summary` |
| Gas report | project root | `forge test --gas-report` |
| Deploy contracts | project root | `forge script scripts/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast` |
| Install frontend deps | frontend/ | `npm install` |
| Run frontend dev | frontend/ | `npm run dev` |
| Build frontend | frontend/ | `npm run build` |

---

## Security Notes

- Only the keccak256 hash of identity documents is stored on-chain — never raw documents (GDPR Article 17)
- Documents are AES-256-GCM encrypted in the browser before IPFS upload
- Only the assigned verifier can decrypt documents using MetaMask's `eth_decrypt`
- ReentrancyGuard applied to all ETH-transferring functions in KYCGatedAuction
- Pull-payment pattern used — no ETH is pushed to bidders automatically
- AccessControl (OpenZeppelin) used for role separation: DEFAULT_ADMIN_ROLE and VERIFIER_ROLE
- ZK age proofs use Groth16 (BN254) — birthdate never leaves the browser
