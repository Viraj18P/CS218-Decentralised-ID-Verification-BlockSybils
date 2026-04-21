// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Clean interface teammates call from their contracts.
// All proof data uses the same Groth16 format as CredentialVerifier.Groth16Proof.
interface IZKVerification {
    struct Groth16Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    // -----------------------------------------------------------------------
    // Age verification
    // publicSignals: [0] current_days  [1] min_age_days  [2] commitment
    // Returns true if the proof is valid; does NOT revert on failure.
    // -----------------------------------------------------------------------
    function verifyAgeProof(
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view returns (bool);

    // -----------------------------------------------------------------------
    // Credential validity
    // publicSignals: [0] issuer_pubkey_hash  [1] credential_id_hash
    //                [2] schema_hash         [3] binding_commitment
    // credentialId must equal bytes32(publicSignals[1]).
    // -----------------------------------------------------------------------
    function verifyCredentialProof(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view returns (bool);

    // -----------------------------------------------------------------------
    // Nullifier + Merkle inclusion (state-changing — marks nullifier as used)
    // publicSignals: [0] merkle_root  [1] nullifier_hash  [2] external_nullifier
    // Reverts if merkle_root not whitelisted or nullifier already consumed.
    // -----------------------------------------------------------------------
    function verifyAndConsumeNullifier(
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external returns (bool);

    // -----------------------------------------------------------------------
    // Composite: age + credential + nullifier in one proof (state-changing)
    // publicSignals[0..9]: current_days, min_age_days, age_commitment,
    //   issuer_pubkey_hash, credential_id_hash, schema_hash, binding_commitment,
    //   merkle_root, nullifier_hash, external_nullifier
    // -----------------------------------------------------------------------
    function verifyCompositeProof(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external returns (bool);

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------
    function isNullifierUsed(bytes32 nullifierHash) external view returns (bool);

    function isMerkleRootValid(bytes32 root) external view returns (bool);
}
