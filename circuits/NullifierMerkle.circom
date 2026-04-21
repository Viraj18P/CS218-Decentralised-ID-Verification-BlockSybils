pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "./lib/MerkleProof.circom";

// Proves that a holder is a member of the registered-holders Merkle set
// and generates a unique nullifier to prevent Sybil reuse.
//
// Anti-Sybil mechanism:
//   - Each holder has a secret that determines their leaf = Poseidon(secret).
//   - The nullifier = Poseidon(secret, external_nullifier) is context-specific:
//     the same holder submitting twice in the same context reuses the same nullifier,
//     which ZKGateway.sol detects and rejects.
//   - external_nullifier encodes the session/election/service context.
//
// TREE_DEPTH = 20 supports up to 2^20 (~1,048,576) registered holders.
//
// Public signals layout (index → name):
//   [0] merkle_root        — on-chain committed Merkle root in ZKGateway
//   [1] nullifier_hash     — Poseidon(secret, external_nullifier)
//   [2] external_nullifier — session or service ID (e.g. keccak256("election-2024"))
template NullifierMerkle(TREE_DEPTH) {
    // --- Private inputs ---
    signal input secret;
    signal input path_elements[TREE_DEPTH];
    signal input path_indices[TREE_DEPTH];

    // --- Public inputs ---
    signal input merkle_root;
    signal input nullifier_hash;
    signal input external_nullifier;

    // 1. Compute leaf = Poseidon(secret).
    component leafHasher = Poseidon(1);
    leafHasher.inputs[0] <== secret;

    // 2. Verify Merkle inclusion of leaf under merkle_root.
    component merkle = MerkleProofVerifier(TREE_DEPTH);
    merkle.leaf <== leafHasher.out;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path_elements[i] <== path_elements[i];
        merkle.path_indices[i]  <== path_indices[i];
    }
    merkle.root === merkle_root;

    // 3. Verify nullifier = Poseidon(secret, external_nullifier).
    component nullifier = Poseidon(2);
    nullifier.inputs[0] <== secret;
    nullifier.inputs[1] <== external_nullifier;
    nullifier.out === nullifier_hash;
}

component main {
    public [merkle_root, nullifier_hash, external_nullifier]
} = NullifierMerkle(20);
