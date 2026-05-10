# CS218 - Decentralised Identity Verification
### Team BlockSybils

| Name | Roll Number |
|---|---|
| Viraj Samir Patel | 240002079 |
| Subhanshu Kumar | 240021019 |
| Yash Pankaj Choudhary | 240008038 |
| Akarsh Raj | 240051003 |
| Khaled M. Abdul Qader | 240001041 |
| Shlok Parikh | 240008027 |

---

## Project Overview

This project implements a privacy-preserving decentralised identity verification system on Ethereum. Instead of storing raw identity documents on-chain, the system stores only trust-critical information such as document hashes, verification state, issuer metadata, public keys, and revocation status.

The core design principle is:

> **Store only the minimum required data on-chain, keep sensitive identity material off-chain, and make trust decisions auditable, revocable, and composable.**

---

## Problem Statement

Traditional identity verification systems suffer from three major issues:

- users are forced to overshare personal documents
- centralised databases create single points of failure
- revocation and trust updates are difficult to manage transparently

This project addresses those issues by:

- storing only hashes and verification state on-chain
- separating identity state from raw document handling
- using role-based access control for verifier and admin actions
- supporting revocation and extensible credential validation

---

## Key Features

- Privacy-preserving identity storage using `keccak256` hashes instead of raw documents
- Verifier-managed identity lifecycle with `Pending`, `Verified`, and `Revoked` states
- OpenZeppelin-based role management and safety controls
- DID support for issuer identity and public key resolution
- Bitmap-based revocation for gas-efficient credential invalidation
- Credential metadata mapping from credential ID to issuer and revocation index
- Groth16-ready verifier wrapper for future zero-knowledge proof integration
- Modular contract architecture for easier testing, auditing, and extension
- Foundry-based test coverage for registration, authorization, revocation, and verifier logic

---

### High-Level Flows

#### A. Identity Verification Flow

1. A user hashes an identity document off-chain.
2. The user registers only the hash on-chain.
3. The identity enters the `Pending` state.
4. An authorised verifier checks the underlying off-chain document.
5. The verifier marks the identity as `Verified`.
6. If trust later changes, the verifier can revoke the identity.

#### B. DID and Credential Flow

1. An issuer registers a DID and public key.
2. A credential ID is linked to the issuer and a revocation index.
3. The issuer manages revocation bits inside a bitmap registry.
4. A verifier or application resolves credential context and validates whether the credential is still active.

---

## Repository Structure

```text
CS218-Decentralised-ID-Verification-BlockSybils/
|- src/
|  |- IdentityRegistry.sol
|  |- DIDRegistry.sol
|  |- RevocationRegistry.sol
|  |- CredentialMetadataRegistry.sol
|  |- CredentialVerifier.sol
|  |- access/
|  |  |- ProtocolAccessManaged.sol
|  |- interfaces/
|  |  |- IGroth16Verifier.sol
|  |- mocks/
|     |- MockGroth16Verifier.sol
|- test/
|  |- IdentityRegistry.t.sol
|  |- DIDRegistry.t.sol
|  |- RevocationRegistry.t.sol
|  |- CredentialVerifier.t.sol
|- lib/
|  |- forge-std/
|- foundry.toml
|- README.md
```

---

## Use Cases and System Flows

This project is centered on a decentralised identity verification framework. The main objective is to build a system where identity status, issuer trust, and revocation can be managed on-chain without exposing sensitive raw documents.

The KYC-gated auction is a secondary demonstration of how the identity layer can be reused by another smart contract.

### 1. Identity Registration Without Storing Raw Documents

The system allows a user to register their identity on-chain without uploading the original document.

How it works:
- the user prepares an identity document off-chain
- the document is hashed using `keccak256`
- only the hash is stored on-chain
- the user’s identity enters the `Pending` state

Why this matters:
- sensitive personal data is not exposed on-chain
- the blockchain acts as a tamper-resistant proof anchor
- privacy is preserved while keeping identity state auditable

### 2. Authorised Identity Verification

Once a user registers a document hash, authorised verifiers can validate the underlying off-chain document and approve the identity.

How it works:
- the verifier reviews the user’s original document off-chain
- only wallets with verifier permissions can approve identities
- the identity status changes from `Pending` to `Verified`

Why this matters:
- verification is restricted to trusted actors
- trust decisions become transparent and auditable
- the system reflects a realistic verification workflow

### 3. Identity Revocation

An identity should not remain trusted forever if the underlying conditions change.

How it works:
- an authorised verifier can revoke a previously verified identity
- the identity status changes from `Verified` to `Revoked`

Why this matters:
- invalid, compromised, or outdated identities can be disabled
- other applications can immediately detect revoked users
- the system supports dynamic trust instead of one-time approval only

### 4. Efficient Credential Revocation Using Bitmaps

The system supports scalable revocation through bitmap-based storage.

How it works:
- revocation state is stored in packed `uint256` buckets
- each bit represents whether a credential is revoked
- issuers maintain their own revocation namespace

Why this matters:
- much more gas-efficient than storing one boolean per credential
- suitable for larger credential systems
- revocation checks remain simple and fast

### 5. Groth16-Ready Verification Flow

The architecture is designed to support proof-based validation workflows.

How it works:
- credential state is resolved using issuer DID, public key, and revocation metadata
- the verifier wrapper can integrate with a Groth16 verifier contract
- proof validity and credential status can be checked together

Why this matters:
- the project is extensible toward privacy-preserving credential proofs
- users can eventually prove claims without revealing full identity documents
- the design supports future zero-knowledge workflows cleanly

### 6. Practical Add-On: KYC-Gated Auction

A KYC-gated auction is included as an application-layer example built on top of the identity system.

How it works:
- the auction checks whether a wallet is verified before allowing bids
- only verified users can participate

Why this matters:
- demonstrates composability of the identity layer
- shows how identity verification can enforce real business rules
- proves the contracts are usable beyond an isolated registry demo

---

## Detailed Verification Flow

This section describes the exact end-to-end flow followed by the application from the moment a user opens the platform to the point where a verifier approves or revokes the identity.

### 1. User Connects Wallet

- the user opens the frontend and connects MetaMask
- the connected wallet becomes the identity owner address
- the application checks the currently selected network, typically Sepolia

This step ensures that identity registration and later verification actions are tied to a real wallet address.

### 2. User Selects a Verifier

- the frontend shows the list of available authorised verifiers
- the user selects the verifier who should review the submitted identity document
- this selected verifier becomes the intended off-chain reviewer of the uploaded material

This matters because the document should be readable only by the verifier responsible for checking it.

### 3. User Uploads Identity Document

- the user uploads the identity file through the browser
- the file never goes directly on-chain
- the frontend prepares the file for both hashing and secure off-chain storage

### 4. Document Hashing Happens in the Client

- the uploaded document is hashed in the browser using `keccak256`
- this hash acts as the on-chain fingerprint of the document
- if the document changes, the hash changes as well

Only this hash is committed on-chain, preserving privacy while keeping a tamper-evident reference.

### 5. Document Is Encrypted for the Selected Verifier

- before storage, the original document is encrypted off-chain
- the encryption is tied to the selected verifier so that only that verifier can later access the contents
- the user does not publish the readable raw document to the blockchain

This gives the verifier access to the real file while still protecting the document from public exposure.

### 6. Encrypted Document Goes to IPFS via Pinata

- the encrypted file is uploaded to IPFS using Pinata
- Pinata returns a content identifier or gateway link for the encrypted document
- the encrypted payload remains off-chain, while the blockchain stores only the verification-relevant state

This keeps storage costs low and avoids putting sensitive document content into public contract storage.

### 7. User Registers Identity On-Chain

- after hashing and encrypted upload, the user calls the identity registration flow
- the on-chain registry stores the document hash against the user wallet
- the identity status becomes `Pending`

At this point:
- the blockchain knows the user has submitted a document fingerprint
- the verifier can later compare the reviewed document against the registered hash

### 8. Verifier Accesses the Submitted Document

- the verifier connects with MetaMask
- the verifier retrieves the encrypted document reference from the application flow
- the verifier decrypts the document off-chain and reviews its contents

This verification step is intentionally off-chain, because raw identity documents should not be exposed publicly on the blockchain.

### 9. Verifier Confirms Authenticity

- the verifier checks whether the submitted document is valid
- the verifier can also compare the reviewed file against the user’s registered hash
- if everything matches, the verifier approves the user on-chain

Once this transaction succeeds:
- the identity moves from `Pending` to `Verified`
- the verifier address and verification timestamp are recorded

### 10. Verifier Can Revoke Later If Needed

- if the identity later becomes invalid, expired, fraudulent, or compromised, the verifier can revoke it
- the status changes from `Verified` to `Revoked`
- any dependent application immediately sees the updated status

This makes trust dynamic instead of permanent.

### 11. Other Contracts Reuse the Verification State

- other contracts can query whether a wallet is currently verified
- this is where application-layer use cases like KYC-gated participation become possible

The identity layer is therefore not just a registry; it becomes a reusable trust primitive for other decentralised applications.

---

## End-to-End Flows

### User Flow

1. The user connects MetaMask.
2. The user selects a verifier.
3. The user uploads an identity document in the frontend.
4. The document is hashed in the browser using `keccak256`.
5. The original file is encrypted for the selected verifier.
6. The encrypted file is uploaded to IPFS through Pinata.
7. The document hash is registered on-chain.
8. The identity becomes `Pending`.
9. After verifier approval, the identity becomes `Verified`.
10. If trust changes later, the identity can be `Revoked`.

### Verifier Flow

1. The verifier connects MetaMask.
2. The verifier accesses the encrypted document reference off-chain.
3. The verifier decrypts and reviews the submitted identity document.
4. The verifier approves valid identities by calling the on-chain verification flow.
5. The verifier can later revoke identities if necessary.

### Admin Flow

1. The admin manages verifier permissions.
2. The admin can add trusted verifiers.
3. The admin can remove verifiers who are no longer authorised.

### Issuer Flow

1. The issuer registers a DID and public key.
2. The issuer links credentials to metadata on-chain.
3. The issuer manages credential revocation efficiently using bitmaps.

---

## Future Scope

### 1. Real Zero-Knowledge Proof Integration
Future versions can integrate production-grade zero-knowledge proof systems so users can prove identity claims without revealing sensitive personal documents.

### 2. Selective Disclosure of Credentials
The system can be extended to support selective disclosure, allowing users to reveal only the specific information required by an application.

### 3. Cross-Chain Identity Portability
Future implementations can support identity portability across multiple blockchain networks and decentralised applications.

### 4. Production-Grade Security and Deployment
Further work can include smart contract audits, advanced encryption mechanisms, monitoring systems, and scalable deployment infrastructure for real-world usage.

---

## Prerequisites

Install these before starting:

- [Foundry](https://getfoundry.sh/) - Solidity compiler and test framework
- [Node.js](https://nodejs.org/) v18 or higher
- [Git](https://git-scm.com/)
- [MetaMask](https://metamask.io/) browser extension
- a Sepolia RPC provider such as [Alchemy](https://alchemy.com/)

If your frontend uses document upload or IPFS storage, you may also need:

- [Pinata](https://pinata.cloud/) or another IPFS pinning service

---

## 1. Clone and Install

### Directory: project root
```bash
git clone https://github.com/Viraj18P/CS218-Decentralised-ID-Verification-BlockSybils.git
cd CS218-Decentralised-ID-Verification-BlockSybils
```

### Install Foundry dependencies
### Directory: project root
```bash
forge install
```

If your repository includes a frontend:

### Directory: frontend/
```bash
cd frontend
npm install
cd ..
```

---

## 2. Environment Setup

### Directory: project root

Create a `.env` file:

```bash
touch .env
```

Add your environment variables:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

Load the environment variables:

```bash
source .env
```

> Security: never commit `.env` to GitHub.

---

## 3. Compile Contracts

### Directory: project root
```bash
forge build
```

Expected output:

```text
Compiler run successful
```

---

## 4. Run Tests

### Directory: project root

Run all tests:

```bash
forge test -vv
```

Run specific test suites:

```bash
forge test --match-contract IdentityRegistryTest -vv
forge test --match-contract DIDRegistryTest -vv
forge test --match-contract RevocationRegistryTest -vv
forge test --match-contract CredentialVerifierTest -vv
```

Expected result: all tests pass, `0 failed`.

---

## 5. Coverage Report

### Directory: project root
```bash
forge coverage --report summary
```

---

## 6. Gas Report

### Directory: project root
```bash
forge test --gas-report
```

This is useful for documenting bitmap revocation savings and overall contract efficiency.

---

## 7. Deploy Contracts

### Directory: project root

Make sure `.env` is loaded first:

```bash
source .env
```

If your repository includes a deployment script, run:

```bash
forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

If deployment scripts are not yet included, deploy the contracts manually or add a deployment script before public release.

---

## 8. Local Frontend Setup

If your repository includes a frontend:

### Directory: frontend/
```bash
npm run dev
```

For production:

```bash
npm run build
npm run preview
```

---

## Security Notes

- only hashes, public keys, and trust state are stored on-chain
- raw identity documents should remain off-chain
- OpenZeppelin `AccessControl` is used for verifier/admin separation
- `Pausable` is used for emergency stops
- bitmap revocation reduces storage overhead for credential invalidation
- the mock verifier is for tests only; production should use a real verifier contract

---

## Why This Design Matters

- **Privacy**: sensitive identity material stays off-chain
- **Auditability**: verifier actions and status changes are transparent
- **Revocability**: trust can be updated cleanly when circumstances change
- **Extensibility**: supports both simple identity flows and richer credential-based designs
- **Composability**: verification logic can be reused by other contracts and applications

---

## Limitations

- raw document review still happens off-chain
- the repository uses a mock verifier for local proof testing
- the verifier-managed identity flow and credential flow are complementary, not unified into one production protocol
- end-to-end frontend and encrypted document handling depend on the final GitHub repo implementation

---

## Team Note

This repository is designed as both an academic project submission and a practical foundation for decentralised identity experiments. It prioritizes modularity, privacy-aware design, role-based security, and demonstrable smart contract engineering.


