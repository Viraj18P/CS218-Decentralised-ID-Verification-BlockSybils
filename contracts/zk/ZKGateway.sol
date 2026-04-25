// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKVerification} from "./IZKVerification.sol";

// ── snarkjs-generated verifier interfaces ────────────────────────────────────
// snarkjs ALWAYS generates fixed-size arrays, not dynamic uint256[].
// Using the wrong signature causes a selector mismatch → CALL_EXCEPTION.

interface IVerifier3 {
    /// @dev selector: 0x82d074f1 — matches AgeVerifier + NullifierMerkleVerifier
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals
    ) external view returns (bool);
}

interface IVerifier4 {
    /// @dev selector: 0xb43c87f2 — matches CredentialValidVerifier
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) external view returns (bool);
}

interface IVerifier10 {
    /// @dev selector matches CompositeProofVerifier (10 public signals)
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[10] calldata _pubSignals
    ) external view returns (bool);
}
// ─────────────────────────────────────────────────────────────────────────────

/// @title  ZKGateway
/// @notice Standalone ZK orchestrator. Routes proofs to the correct snarkjs-generated
///         Groth16 verifier, enforces signal counts, tracks nullifiers, and manages
///         Merkle root whitelist.
/// @dev    Each verifier is called with its EXACT fixed-array signature as generated
///         by `snarkjs zkey export solidityverifier`. Using dynamic uint256[] arrays
///         would produce a different ABI selector and cause CALL_EXCEPTION.
contract ZKGateway is IZKVerification {

    // ── Errors ────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error Unauthorized();
    error NullifierAlreadyUsed(bytes32 nullifierHash);
    error InvalidMerkleRoot(bytes32 root);
    error WrongSignalCount(uint256 got, uint256 expected);
    error CredentialIdMismatch(bytes32 expected, bytes32 inProof);

    // ── Events ────────────────────────────────────────────────────────────────
    event AgeProofVerified(address indexed subject, uint256 currentDays, bytes32 commitment);
    event CredentialProofVerified(address indexed subject, bytes32 indexed credentialId);
    event NullifierConsumed(bytes32 indexed nullifierHash, bytes32 indexed externalNullifier);
    event CompositeProofVerified(
        address indexed subject, bytes32 indexed credentialId, bytes32 indexed nullifierHash
    );
    event MerkleRootAdded(bytes32 indexed root, address indexed addedBy);

    // ── Immutable verifier addresses ──────────────────────────────────────────
    IVerifier3  public immutable ageVerifier;             // 3 signals
    IVerifier4  public immutable credentialValidVerifier; // 4 signals
    IVerifier3  public immutable nullifierMerkleVerifier; // 3 signals
    IVerifier10 public immutable compositeProofVerifier;  // 10 signals

    address public immutable merkleAdmin;

    // ── State ─────────────────────────────────────────────────────────────────
    mapping(bytes32 => bool) private _usedNullifiers;
    mapping(bytes32 => bool) private _validMerkleRoots;

    // Signal counts must match the circuits exactly
    uint256 private constant AGE_SIGNAL_COUNT        = 3;
    uint256 private constant CREDENTIAL_SIGNAL_COUNT = 4;
    uint256 private constant NULLIFIER_SIGNAL_COUNT  = 3;
    uint256 private constant COMPOSITE_SIGNAL_COUNT  = 10;

    // ── Constructor ───────────────────────────────────────────────────────────
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

        ageVerifier             = IVerifier3(ageVerifier_);
        credentialValidVerifier = IVerifier4(credentialValidVerifier_);
        nullifierMerkleVerifier = IVerifier3(nullifierMerkleVerifier_);
        compositeProofVerifier  = IVerifier10(compositeProofVerifier_);
        merkleAdmin             = merkleAdmin_;
    }

    // ── Age proof (view) ──────────────────────────────────────────────────────
    // publicSignals: [0] current_days  [1] min_age_days  [2] commitment
    function verifyAgeProof(
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view override returns (bool) {
        if (publicSignals.length != AGE_SIGNAL_COUNT) {
            revert WrongSignalCount(publicSignals.length, AGE_SIGNAL_COUNT);
        }
        // Convert dynamic slice to fixed array — Solidity requires explicit copy
        uint256[3] memory sigs = [publicSignals[0], publicSignals[1], publicSignals[2]];
        return ageVerifier.verifyProof(proof.a, proof.b, proof.c, sigs);
    }

    // ── Credential validity proof (view) ─────────────────────────────────────
    // publicSignals: [0] issuer_pubkey_hash  [1] credential_id_hash
    //                [2] schema_hash         [3] binding_commitment
    function verifyCredentialProof(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view override returns (bool) {
        if (publicSignals.length != CREDENTIAL_SIGNAL_COUNT) {
            revert WrongSignalCount(publicSignals.length, CREDENTIAL_SIGNAL_COUNT);
        }
        bytes32 proofCredentialId = bytes32(publicSignals[1]);
        if (proofCredentialId != credentialId) {
            revert CredentialIdMismatch(credentialId, proofCredentialId);
        }
        uint256[4] memory sigs = [publicSignals[0], publicSignals[1], publicSignals[2], publicSignals[3]];
        return credentialValidVerifier.verifyProof(proof.a, proof.b, proof.c, sigs);
    }

    // ── Nullifier + Merkle inclusion (state-changing) ─────────────────────────
    // publicSignals: [0] merkle_root  [1] nullifier_hash  [2] external_nullifier
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

        uint256[3] memory sigs = [publicSignals[0], publicSignals[1], publicSignals[2]];
        bool ok = nullifierMerkleVerifier.verifyProof(proof.a, proof.b, proof.c, sigs);
        if (ok) {
            _usedNullifiers[nullifierHash] = true;
            emit NullifierConsumed(nullifierHash, extNullifier);
        }
        return ok;
    }

    // ── Composite proof (state-changing) ─────────────────────────────────────
    // publicSignals[0..9]: current_days, min_age_days, age_commitment,
    //   issuer_pubkey_hash, credential_id_hash, schema_hash, binding_commitment,
    //   merkle_root, nullifier_hash, external_nullifier
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

        uint256[10] memory sigs;
        for (uint256 i = 0; i < 10; i++) sigs[i] = publicSignals[i];

        bool ok = compositeProofVerifier.verifyProof(proof.a, proof.b, proof.c, sigs);
        if (ok) {
            _usedNullifiers[nullifierHash] = true;
            emit NullifierConsumed(nullifierHash, extNullifier);
            emit CompositeProofVerified(msg.sender, credentialId, nullifierHash);
        }
        return ok;
    }

    // ── Merkle root management ────────────────────────────────────────────────
    function addMerkleRoot(bytes32 root) external {
        if (msg.sender != merkleAdmin) revert Unauthorized();
        _validMerkleRoots[root] = true;
        emit MerkleRootAdded(root, msg.sender);
    }

    // ── Read-only queries ─────────────────────────────────────────────────────
    function isNullifierUsed(bytes32 nullifierHash) external view override returns (bool) {
        return _usedNullifiers[nullifierHash];
    }

    function isMerkleRootValid(bytes32 root) external view override returns (bool) {
        return _validMerkleRoots[root];
    }
}
