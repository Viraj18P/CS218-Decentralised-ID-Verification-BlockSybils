// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGroth16Verifier} from "../../interfaces/IGroth16Verifier.sol";
import {IZKVerification} from "./IZKVerification.sol";

// Standalone ZK orchestrator. Teammates call this contract instead of individual verifiers.
// Responsibilities:
//   - Route proofs to the correct circuit verifier.
//   - Enforce per-circuit public signal count.
//   - Cross-check on-chain identifiers (credentialId) against proof public signals.
//   - Maintain nullifier registry (consumed → true) to prevent Sybil reuse.
//   - Maintain whitelist of valid Merkle roots (managed by merkleAdmin).
//
// Deploy by passing four verifier addresses (from contracts/verifiers/) and an admin.
// After zk_setup.sh, replace placeholder verifiers with real snarkjs-generated ones.
contract ZKGateway is IZKVerification {
    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------
    error ZeroAddress();
    error Unauthorized();
    error NullifierAlreadyUsed(bytes32 nullifierHash);
    error InvalidMerkleRoot(bytes32 root);
    error WrongSignalCount(uint256 got, uint256 expected);
    error CredentialIdMismatch(bytes32 expected, bytes32 inProof);

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    event AgeProofVerified(address indexed subject, uint256 currentDays, bytes32 commitment);
    event CredentialProofVerified(address indexed subject, bytes32 indexed credentialId);
    event NullifierConsumed(bytes32 indexed nullifierHash, bytes32 indexed externalNullifier);
    event CompositeProofVerified(
        address indexed subject, bytes32 indexed credentialId, bytes32 indexed nullifierHash
    );
    event MerkleRootAdded(bytes32 indexed root, address indexed addedBy);

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    IGroth16Verifier public immutable ageVerifier;
    IGroth16Verifier public immutable credentialValidVerifier;
    IGroth16Verifier public immutable nullifierMerkleVerifier;
    IGroth16Verifier public immutable compositeProofVerifier;

    address public immutable merkleAdmin;

    // Consumed nullifiers (nullifierHash => consumed).
    mapping(bytes32 => bool) private _usedNullifiers;

    // Whitelisted Merkle roots (root => valid).
    mapping(bytes32 => bool) private _validMerkleRoots;

    // Expected public signal counts per circuit.
    uint256 private constant AGE_SIGNAL_COUNT        = 3;
    uint256 private constant CREDENTIAL_SIGNAL_COUNT = 4;
    uint256 private constant NULLIFIER_SIGNAL_COUNT  = 3;
    uint256 private constant COMPOSITE_SIGNAL_COUNT  = 10;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    constructor(
        address ageVerifier_,
        address credentialValidVerifier_,
        address nullifierMerkleVerifier_,
        address compositeProofVerifier_,
        address merkleAdmin_
    ) {
        if (
            ageVerifier_ == address(0)
                || credentialValidVerifier_ == address(0)
                || nullifierMerkleVerifier_ == address(0)
                || compositeProofVerifier_ == address(0)
                || merkleAdmin_ == address(0)
        ) revert ZeroAddress();

        ageVerifier              = IGroth16Verifier(ageVerifier_);
        credentialValidVerifier  = IGroth16Verifier(credentialValidVerifier_);
        nullifierMerkleVerifier  = IGroth16Verifier(nullifierMerkleVerifier_);
        compositeProofVerifier   = IGroth16Verifier(compositeProofVerifier_);
        merkleAdmin              = merkleAdmin_;
    }

    // -----------------------------------------------------------------------
    // Age proof
    // publicSignals: [0] current_days  [1] min_age_days  [2] commitment
    // -----------------------------------------------------------------------
    function verifyAgeProof(
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view override returns (bool) {
        if (publicSignals.length != AGE_SIGNAL_COUNT) {
            revert WrongSignalCount(publicSignals.length, AGE_SIGNAL_COUNT);
        }
        bool ok = ageVerifier.verifyProof(proof.a, proof.b, proof.c, publicSignals);
        // Note: view function — event emission is not possible here. Callers should
        // emit their own events if they need audit trails for age checks.
        return ok;
    }

    // -----------------------------------------------------------------------
    // Credential validity proof
    // publicSignals: [0] issuer_pubkey_hash  [1] credential_id_hash
    //                [2] schema_hash         [3] binding_commitment
    // -----------------------------------------------------------------------
    function verifyCredentialProof(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view override returns (bool) {
        if (publicSignals.length != CREDENTIAL_SIGNAL_COUNT) {
            revert WrongSignalCount(publicSignals.length, CREDENTIAL_SIGNAL_COUNT);
        }
        // Prevent a valid proof for one credential being replayed against another.
        bytes32 proofCredentialId = bytes32(publicSignals[1]);
        if (proofCredentialId != credentialId) {
            revert CredentialIdMismatch(credentialId, proofCredentialId);
        }
        return credentialValidVerifier.verifyProof(proof.a, proof.b, proof.c, publicSignals);
    }

    // -----------------------------------------------------------------------
    // Nullifier + Merkle inclusion (state-changing)
    // publicSignals: [0] merkle_root  [1] nullifier_hash  [2] external_nullifier
    // -----------------------------------------------------------------------
    function verifyAndConsumeNullifier(
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external override returns (bool) {
        if (publicSignals.length != NULLIFIER_SIGNAL_COUNT) {
            revert WrongSignalCount(publicSignals.length, NULLIFIER_SIGNAL_COUNT);
        }

        bytes32 merkleRoot    = bytes32(publicSignals[0]);
        bytes32 nullifierHash = bytes32(publicSignals[1]);
        bytes32 extNullifier  = bytes32(publicSignals[2]);

        if (!_validMerkleRoots[merkleRoot]) revert InvalidMerkleRoot(merkleRoot);
        if (_usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);

        bool ok = nullifierMerkleVerifier.verifyProof(proof.a, proof.b, proof.c, publicSignals);
        if (ok) {
            _usedNullifiers[nullifierHash] = true;
            emit NullifierConsumed(nullifierHash, extNullifier);
        }
        return ok;
    }

    // -----------------------------------------------------------------------
    // Composite proof (state-changing)
    // publicSignals[0..9]: current_days, min_age_days, age_commitment,
    //   issuer_pubkey_hash, credential_id_hash, schema_hash, binding_commitment,
    //   merkle_root, nullifier_hash, external_nullifier
    // -----------------------------------------------------------------------
    function verifyCompositeProof(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external override returns (bool) {
        if (publicSignals.length != COMPOSITE_SIGNAL_COUNT) {
            revert WrongSignalCount(publicSignals.length, COMPOSITE_SIGNAL_COUNT);
        }

        bytes32 proofCredentialId = bytes32(publicSignals[4]);
        if (proofCredentialId != credentialId) {
            revert CredentialIdMismatch(credentialId, proofCredentialId);
        }

        bytes32 merkleRoot    = bytes32(publicSignals[7]);
        bytes32 nullifierHash = bytes32(publicSignals[8]);
        bytes32 extNullifier  = bytes32(publicSignals[9]);

        if (!_validMerkleRoots[merkleRoot]) revert InvalidMerkleRoot(merkleRoot);
        if (_usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);

        bool ok = compositeProofVerifier.verifyProof(proof.a, proof.b, proof.c, publicSignals);
        if (ok) {
            _usedNullifiers[nullifierHash] = true;
            emit CompositeProofVerified(msg.sender, credentialId, nullifierHash);
        }
        return ok;
    }

    // -----------------------------------------------------------------------
    // Merkle root management (admin only)
    // -----------------------------------------------------------------------
    function addMerkleRoot(bytes32 root) external {
        if (msg.sender != merkleAdmin) revert Unauthorized();
        _validMerkleRoots[root] = true;
        emit MerkleRootAdded(root, msg.sender);
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------
    function isNullifierUsed(bytes32 nullifierHash) external view override returns (bool) {
        return _usedNullifiers[nullifierHash];
    }

    function isMerkleRootValid(bytes32 root) external view override returns (bool) {
        return _validMerkleRoots[root];
    }
}
