// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CredentialMetadataRegistry} from "./CredentialMetadataRegistry.sol";
import {DIDRegistry} from "./DIDRegistry.sol";
import {RevocationRegistry} from "./RevocationRegistry.sol";

/// @dev Matches the exact signature snarkjs generates for a 4-signal circuit.
///      Using uint256[] here would produce a different selector and revert.
interface IGroth16Verifier4 {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) external view returns (bool);
}

contract CredentialVerifier {
    struct Groth16Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    error ZeroAddress();
    error InvalidProof(bytes32 credentialId);
    error CredentialRevoked(bytes32 credentialId, address issuer, uint256 revocationIndex);
    error WrongSignalCount(uint256 got, uint256 expected);

    DIDRegistry public immutable didRegistry;
    RevocationRegistry public immutable revocationRegistry;
    CredentialMetadataRegistry public immutable credentialMetadataRegistry;
    IGroth16Verifier4 public immutable groth16Verifier;

    constructor(
        address didRegistry_,
        address revocationRegistry_,
        address credentialMetadataRegistry_,
        address groth16Verifier_
    ) {
        if (
            didRegistry_ == address(0)
                || revocationRegistry_ == address(0)
                || credentialMetadataRegistry_ == address(0)
                || groth16Verifier_ == address(0)
        ) {
            revert ZeroAddress();
        }

        didRegistry = DIDRegistry(didRegistry_);
        revocationRegistry = RevocationRegistry(revocationRegistry_);
        credentialMetadataRegistry = CredentialMetadataRegistry(credentialMetadataRegistry_);
        groth16Verifier = IGroth16Verifier4(groth16Verifier_);
    }

    /// @notice Validates a credential proof, checking revocation first.
    function validateCredential(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view returns (bool) {
        if (publicSignals.length != 4) revert WrongSignalCount(publicSignals.length, 4);

        (, address issuer, uint256 revocationIndex) = credentialMetadataRegistry.getCredential(credentialId);
        if (revocationRegistry.isRevoked(issuer, revocationIndex)) {
            return false;
        }

        uint256[4] memory sigs = [publicSignals[0], publicSignals[1], publicSignals[2], publicSignals[3]];
        return groth16Verifier.verifyProof(proof.a, proof.b, proof.c, sigs);
    }

    /// @notice Validates a credential proof, reverting on failure.
    function verifyPresentationOrRevert(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view returns (bool) {
        if (publicSignals.length != 4) revert WrongSignalCount(publicSignals.length, 4);

        (, address issuer, uint256 revocationIndex) = credentialMetadataRegistry.getCredential(credentialId);
        if (revocationRegistry.isRevoked(issuer, revocationIndex)) {
            revert CredentialRevoked(credentialId, issuer, revocationIndex);
        }

        uint256[4] memory sigs = [publicSignals[0], publicSignals[1], publicSignals[2], publicSignals[3]];
        if (!groth16Verifier.verifyProof(proof.a, proof.b, proof.c, sigs)) {
            revert InvalidProof(credentialId);
        }

        return true;
    }

    /// @notice Resolves full credential context for off-chain display.
    function resolveCredentialContext(
        bytes32 credentialId
    )
        external
        view
        returns (
            string memory issuerDID,
            address issuer,
            bytes memory issuerPublicKey,
            uint256 revocationIndex,
            bool revoked
        )
    {
        (issuerDID, issuer, revocationIndex) = credentialMetadataRegistry.getCredential(credentialId);
        issuerPublicKey = didRegistry.getPublicKey(issuerDID);
        revoked = revocationRegistry.isRevoked(issuer, revocationIndex);
    }
}
