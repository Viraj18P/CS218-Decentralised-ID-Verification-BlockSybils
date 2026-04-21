pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Proves that a holder possesses the credential secret the issuer embedded in a VC.
//
// Issuance protocol (off-chain):
//   1. Issuer picks credential_secret (random field element).
//   2. Issuer computes credential_id = Poseidon(credential_secret, issuer_pubkey_hash)
//      and registers it on-chain via CredentialMetadataRegistry.
//   3. Issuer delivers credential_secret to holder inside the signed VC.
//
// The holder proves knowledge of credential_secret without revealing it.
//
// Public signals layout (index → name):
//   [0] issuer_pubkey_hash   — Poseidon(keccak256(issuerPubKey) mod p)
//   [1] credential_id_hash   — on-chain bytes32 credentialId cast to uint256
//   [2] schema_hash          — Poseidon hash of the credential schema URI
//   [3] binding_commitment   — Poseidon(credential_secret, schema_hash, salt)
template CredentialValid() {
    // --- Private inputs ---
    signal input credential_secret;
    signal input salt;

    // --- Public inputs ---
    signal input issuer_pubkey_hash;
    signal input credential_id_hash;
    signal input schema_hash;
    signal input binding_commitment;

    // 1. Verify credential_id = Poseidon(credential_secret, issuer_pubkey_hash).
    //    Proves the holder knows the secret embedded by this specific issuer.
    component idHasher = Poseidon(2);
    idHasher.inputs[0] <== credential_secret;
    idHasher.inputs[1] <== issuer_pubkey_hash;
    idHasher.out === credential_id_hash;

    // 2. Verify binding commitment (ties credential secret to schema + blinding salt).
    component bindHasher = Poseidon(3);
    bindHasher.inputs[0] <== credential_secret;
    bindHasher.inputs[1] <== schema_hash;
    bindHasher.inputs[2] <== salt;
    bindHasher.out === binding_commitment;
}

component main {
    public [issuer_pubkey_hash, credential_id_hash, schema_hash, binding_commitment]
} = CredentialValid();
