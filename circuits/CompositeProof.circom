pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "./lib/MerkleProof.circom";

// Composite proof: age check + credential validity + Merkle nullifier in one Groth16 proof.
// One on-chain pairing check replaces three separate verifier calls, saving ~150k gas.
//
// Private inputs: all private fields from the three sub-circuits combined.
// Public signals layout (index → name):
//   [0]  current_days        — AgeVerifier: days since epoch at proof time
//   [1]  min_age_days        — AgeVerifier: minimum age in days
//   [2]  age_commitment      — AgeVerifier: Poseidon(birthdate_days, age_salt)
//   [3]  issuer_pubkey_hash  — CredentialValid: Poseidon(keccak256(issuerPubKey) mod p)
//   [4]  credential_id_hash  — CredentialValid: on-chain credentialId as uint256
//   [5]  schema_hash         — CredentialValid: Poseidon hash of schema URI
//   [6]  binding_commitment  — CredentialValid: Poseidon(cred_secret, schema_hash, cred_salt)
//   [7]  merkle_root         — NullifierMerkle: on-chain committed root
//   [8]  nullifier_hash      — NullifierMerkle: Poseidon(secret, external_nullifier)
//   [9]  external_nullifier  — NullifierMerkle: session/service context ID
template CompositeProof(TREE_DEPTH) {
    // --- Private inputs: AgeVerifier ---
    signal input birthdate_days;
    signal input age_salt;

    // --- Private inputs: CredentialValid ---
    signal input credential_secret;
    signal input cred_salt;

    // --- Private inputs: NullifierMerkle ---
    signal input secret;
    signal input path_elements[TREE_DEPTH];
    signal input path_indices[TREE_DEPTH];

    // --- Public inputs ---
    signal input current_days;
    signal input min_age_days;
    signal input age_commitment;
    signal input issuer_pubkey_hash;
    signal input credential_id_hash;
    signal input schema_hash;
    signal input binding_commitment;
    signal input merkle_root;
    signal input nullifier_hash;
    signal input external_nullifier;

    // ================================================================
    // Sub-circuit 1: Age verification
    // ================================================================
    component ageHasher = Poseidon(2);
    ageHasher.inputs[0] <== birthdate_days;
    ageHasher.inputs[1] <== age_salt;
    age_commitment === ageHasher.out;

    signal age_days;
    age_days <== current_days - birthdate_days;

    component gte = GreaterEqThan(32);
    gte.in[0] <== age_days;
    gte.in[1] <== min_age_days;
    gte.out === 1;

    // ================================================================
    // Sub-circuit 2: Credential validity
    // ================================================================
    component idHasher = Poseidon(2);
    idHasher.inputs[0] <== credential_secret;
    idHasher.inputs[1] <== issuer_pubkey_hash;
    idHasher.out === credential_id_hash;

    component bindHasher = Poseidon(3);
    bindHasher.inputs[0] <== credential_secret;
    bindHasher.inputs[1] <== schema_hash;
    bindHasher.inputs[2] <== cred_salt;
    bindHasher.out === binding_commitment;

    // ================================================================
    // Sub-circuit 3: Merkle inclusion + nullifier
    // ================================================================
    component leafHasher = Poseidon(1);
    leafHasher.inputs[0] <== secret;

    component merkle = MerkleProofVerifier(TREE_DEPTH);
    merkle.leaf <== leafHasher.out;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path_elements[i] <== path_elements[i];
        merkle.path_indices[i]  <== path_indices[i];
    }
    merkle.root === merkle_root;

    component nullifier = Poseidon(2);
    nullifier.inputs[0] <== secret;
    nullifier.inputs[1] <== external_nullifier;
    nullifier.out === nullifier_hash;
}

component main {
    public [
        current_days, min_age_days, age_commitment,
        issuer_pubkey_hash, credential_id_hash, schema_hash, binding_commitment,
        merkle_root, nullifier_hash, external_nullifier
    ]
} = CompositeProof(20);
