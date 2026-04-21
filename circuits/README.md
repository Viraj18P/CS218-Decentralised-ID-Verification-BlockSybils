# circuits/

Circom 2.0 circuits for the BlockSybils ZK identity verification layer.
All circuits use the BN254 scalar field and Poseidon hash from [circomlib](https://github.com/iden3/circomlib).

---

## Circuit inventory

### `AgeVerifier.circom`
**Purpose:** Prove age ≥ threshold without revealing birthdate.

| Signal | Visibility | Description |
|--------|-----------|-------------|
| `birthdate_days` | private | Days since Unix epoch |
| `salt` | private | Blinding factor for commitment |
| `current_days` | **public [0]** | `floor(block.timestamp / 86400)` |
| `min_age_days` | **public [1]** | Minimum age in days (e.g. `18 * 365 = 6570`) |
| `commitment` | **public [2]** | `Poseidon(birthdate_days, salt)` |

Constraint count: ~500 (Poseidon(2) + GreaterEqThan(32)).

---

### `CredentialValid.circom`
**Purpose:** Prove possession of a valid credential issued by a known issuer.

Issuance protocol: issuer computes `credentialId = Poseidon(credential_secret, issuer_pubkey_hash)` and registers it on-chain. Holder proves knowledge of `credential_secret`.

| Signal | Visibility | Description |
|--------|-----------|-------------|
| `credential_secret` | private | Secret shared issuer → holder off-chain |
| `salt` | private | Blinding factor |
| `issuer_pubkey_hash` | **public [0]** | `Poseidon(keccak256(issuerPubKey) mod p)` |
| `credential_id_hash` | **public [1]** | On-chain `bytes32 credentialId` as `uint256` |
| `schema_hash` | **public [2]** | `Poseidon` hash of credential schema URI |
| `binding_commitment` | **public [3]** | `Poseidon(credential_secret, schema_hash, salt)` |

Constraint count: ~500 (two Poseidon calls).

---

### `NullifierMerkle.circom`
**Purpose:** Prove Merkle set membership and generate a unique nullifier (anti-Sybil).

Tree depth = 20 → supports up to 2²⁰ ≈ 1,048,576 registered holders.

| Signal | Visibility | Description |
|--------|-----------|-------------|
| `secret` | private | Holder's identity secret; leaf = `Poseidon(secret)` |
| `path_elements[20]` | private | Sibling hashes along the Merkle path |
| `path_indices[20]` | private | `0` = current node is left child |
| `merkle_root` | **public [0]** | On-chain committed root in `ZKGateway` |
| `nullifier_hash` | **public [1]** | `Poseidon(secret, external_nullifier)` |
| `external_nullifier` | **public [2]** | Session/election/service context ID |

Constraint count: ~5,500 (20 × Poseidon(2) + Mux1 pairs + Poseidon(1) + Poseidon(2)).

---

### `CompositeProof.circom`
**Purpose:** Combines all three sub-circuits into a single Groth16 proof, replacing three on-chain verifier calls with one (saves ~150 k gas).

Public signals [0..9]: `current_days`, `min_age_days`, `age_commitment`, `issuer_pubkey_hash`, `credential_id_hash`, `schema_hash`, `binding_commitment`, `merkle_root`, `nullifier_hash`, `external_nullifier`.

Private inputs: union of all three sub-circuit private inputs.

Constraint count: ~7,000 (sum of sub-circuits).

---

## Shared library

### `lib/MerkleProof.circom`
`MerkleProofVerifier(depth)` — reusable Poseidon Merkle proof template. Included by `NullifierMerkle.circom` and `CompositeProof.circom`.

---

## Generating artifacts

Run `scripts/zk_setup.sh` from the project root. It compiles all circuits, runs the Groth16 trusted setup, and exports Solidity verifiers to `contracts/verifiers/`.

```bash
bash scripts/zk_setup.sh
```

Prerequisites: `circom >= 2.0.0`, `snarkjs >= 0.7`, `node >= 18`.

Outputs per circuit:
- `build/<circuit>/<circuit>.r1cs` — rank-1 constraint system
- `build/<circuit>/<circuit>.wasm` — witness generator
- `build/<circuit>/<circuit>_final.zkey` — proving key
- `build/<circuit>/verification_key.json` — verification key
- `contracts/verifiers/<Circuit>.sol` — Solidity verifier (overwrites placeholder)
