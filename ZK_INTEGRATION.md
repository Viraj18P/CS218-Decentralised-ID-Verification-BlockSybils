# ZK Integration Guide

This document describes the zero-knowledge layer added to the BlockSybils identity verification system and explains how teammates can integrate it into their contracts.

---

## What the ZK module does

Four Groth16 circuits (in `circuits/`) let users prove identity claims without revealing private data:

| Circuit | Proves | On-chain state changed? |
|---------|--------|------------------------|
| `AgeVerifier` | Age ≥ threshold | No |
| `CredentialValid` | Holder possesses a valid VC issued by a known issuer | No |
| `NullifierMerkle` | Membership in holder set + unique nullifier | Yes — nullifier consumed |
| `CompositeProof` | All three in one proof | Yes — nullifier consumed |

The `ZKGateway` contract (`contracts/zk/ZKGateway.sol`) is the single on-chain entry point. It routes proofs to the correct verifier, enforces public signal counts, cross-checks on-chain identifiers, and tracks consumed nullifiers.

---

## Prerequisites

### To generate ZK artifacts (circuits → Solidity verifiers)

```bash
# Install circom (see https://docs.circom.io/getting-started/installation/)
# Then:
npm install -g snarkjs
npm install circomlib   # Poseidon, comparators, mux1
```

### To compile and test Solidity

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install forge-std
forge install foundry-rs/forge-std
```

> **Note:** `src/CredentialVerifier.sol` has a pre-existing import path issue — it imports `"./interfaces/IGroth16Verifier.sol"` but the file lives at `interfaces/IGroth16Verifier.sol` (root level). Change that import to `"../interfaces/IGroth16Verifier.sol"` to fix compilation.

---

## Step 1 — Generate ZK artifacts

Run from project root (WSL or Linux):

```bash
bash scripts/zk_setup.sh
```

This compiles each circuit, runs a Groth16 trusted setup, and overwrites the placeholder Solidity verifiers in `contracts/verifiers/` with real verifiers containing the correct proving keys.

**For production:** replace the single-contributor entropy in `zk_setup.sh` with a real multi-party Powers of Tau ceremony (e.g. download from [Hermez](https://github.com/iden3/snarkjs#7-prepare-phase-2)).

---

## Step 2 — Deploy

Deploy in this order:

```solidity
// 1. Deploy four verifiers (output of zk_setup.sh)
AgeVerifier            ageV    = new AgeVerifier();
CredentialValidVerifier credV   = new CredentialValidVerifier();
NullifierMerkleVerifier nullV   = new NullifierMerkleVerifier();
CompositeProofVerifier  compV   = new CompositeProofVerifier();

// 2. Deploy ZKGateway
ZKGateway gateway = new ZKGateway(
    address(ageV), address(credV), address(nullV), address(compV),
    ADMIN_ADDRESS
);

// 3. Admin whitelists the initial Merkle root
vm.prank(ADMIN_ADDRESS);
gateway.addMerkleRoot(INITIAL_MERKLE_ROOT);
```

---

## Step 3 — Calling ZKGateway from your contract

Import the interface:

```solidity
import {IZKVerification} from "../contracts/zk/IZKVerification.sol";
```

Inject the gateway address and call it:

```solidity
contract MyService {
    IZKVerification private immutable zkGateway;

    constructor(address zkGateway_) {
        zkGateway = IZKVerification(zkGateway_);
    }

    // Age-gated action
    function adultOnlyAction(
        IZKVerification.Groth16Proof calldata proof,
        uint256[] calldata publicSignals   // [current_days, min_age_days, commitment]
    ) external {
        require(zkGateway.verifyAgeProof(proof, publicSignals), "Age proof invalid");
        // ... your logic
    }

    // Sybil-resistant action
    function onePersonOneVote(
        IZKVerification.Groth16Proof calldata proof,
        uint256[] calldata publicSignals   // [merkle_root, nullifier_hash, external_nullifier]
    ) external {
        // Reverts if proof is invalid, root is not whitelisted, or nullifier already used.
        require(zkGateway.verifyAndConsumeNullifier(proof, publicSignals), "Proof invalid");
        // ... your voting logic
    }
}
```

---

## Public signal formats

### AgeVerifier — 3 signals

| Index | Name | Value |
|-------|------|-------|
| 0 | `current_days` | `block.timestamp / 86400` |
| 1 | `min_age_days` | Minimum age in days (e.g. `18 * 365 = 6570`) |
| 2 | `commitment` | `Poseidon(birthdate_days, salt)` |

### CredentialValid — 4 signals

| Index | Name | Value |
|-------|------|-------|
| 0 | `issuer_pubkey_hash` | `Poseidon(keccak256(issuerPubKey) mod p)` |
| 1 | `credential_id_hash` | On-chain `bytes32 credentialId` cast to `uint256` |
| 2 | `schema_hash` | `Poseidon` hash of credential schema URI |
| 3 | `binding_commitment` | `Poseidon(credential_secret, schema_hash, salt)` |

> `bytes32(publicSignals[1])` must equal the `credentialId` you pass to `verifyCredentialProof`.

### NullifierMerkle — 3 signals

| Index | Name | Value |
|-------|------|-------|
| 0 | `merkle_root` | Whitelisted on-chain Merkle root |
| 1 | `nullifier_hash` | `Poseidon(secret, external_nullifier)` |
| 2 | `external_nullifier` | Context ID (e.g. `uint256(keccak256("vote-2024"))`) |

### CompositeProof — 10 signals

Indices 0–2: AgeVerifier signals (`current_days`, `min_age_days`, `age_commitment`).  
Indices 3–6: CredentialValid signals (`issuer_pubkey_hash`, `credential_id_hash`, `schema_hash`, `binding_commitment`).  
Indices 7–9: NullifierMerkle signals (`merkle_root`, `nullifier_hash`, `external_nullifier`).

---

## Client-side proof generation flow

```js
import { groth16 } from "snarkjs";

// 1. Load circuit artifacts (generated by zk_setup.sh)
const wasmPath = "build/AgeVerifier/AgeVerifier.wasm";
const zkeyPath = "build/AgeVerifier/AgeVerifier_final.zkey";

// 2. Prepare private and public inputs
const currentDays = Math.floor(Date.now() / 1000 / 86400);
const input = {
    birthdate_days: Math.floor(birthdateUnixSeconds / 86400),  // private
    salt: generateRandomFieldElement(),                          // private
    current_days: currentDays,                                   // public
    min_age_days: 18 * 365,                                      // public
    commitment: poseidon([birthdate_days, salt]),                 // public (precomputed)
};

// 3. Generate proof
const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);

// 4. Format for Solidity
const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
// calldata gives you the a, b, c, input arrays to pass to verifyProof
```

Use [circomlibjs](https://github.com/iden3/circomlibjs) for Poseidon hashing in JavaScript.

---

## Merkle tree management

The Merkle tree of registered holders is maintained off-chain. When a new holder is added:

1. Recompute the tree root using `Poseidon` hashing.
2. Call `ZKGateway.addMerkleRoot(newRoot)` from the `merkleAdmin` address.
3. Old roots remain valid (accumulator model) — holders can still prove against any whitelisted root.

---

## Running the ZK tests

```bash
# After forge install foundry-rs/forge-std:
forge test --match-path "test/zk/*" -vvv
```

Tests use `MockGroth16Verifier` (from `mocks/`) to control proof outcomes without real ZK proofs. All routing logic, nullifier tracking, and Merkle root enforcement are fully tested.

---

## Conflict flags

| Issue | Location | Action needed |
|-------|----------|---------------|
| `src/CredentialVerifier.sol` imports `"./interfaces/..."` but file is at root `interfaces/` | `src/CredentialVerifier.sol:7` | Change to `"../interfaces/IGroth16Verifier.sol"` |
| `lib/forge-std` missing | project root | `forge install foundry-rs/forge-std` |
| `node_modules/circomlib` missing | project root | `npm install circomlib` before running `zk_setup.sh` |
