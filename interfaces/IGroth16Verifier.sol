// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface that matches the exact function signature snarkjs generates.
///
/// snarkjs always emits:
///   function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB,
///                        uint[2] calldata _pC, uint[N] calldata _pubSignals)
///
/// The signal count N is circuit-specific:
///   AgeVerifier       → 3 signals
///   CredentialValid   → 4 signals
///   NullifierMerkle   → 3 signals
///   CompositeProof    → 10 signals
///
/// We use uint256[3] here to match AgeVerifier (and NullifierMerkle).
/// ZKGateway calls each verifier with the right fixed array size.
interface IGroth16Verifier {
    /// @notice Verifies a Groth16 proof with exactly 3 public signals.
    ///         Matches the AgeVerifier and NullifierMerkleVerifier generated ABI.
    /// @dev    Selector: 0x82d074f1
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals
    ) external view returns (bool);
}

/// @notice Separate interface for verifiers with 4 public signals (CredentialValid).
interface IGroth16Verifier4 {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) external view returns (bool);
}

/// @notice Separate interface for verifiers with 10 public signals (CompositeProof).
interface IGroth16Verifier10 {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[10] calldata _pubSignals
    ) external view returns (bool);
}
