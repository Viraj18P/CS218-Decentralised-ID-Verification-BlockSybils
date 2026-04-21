// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CredentialMetadataRegistry} from "./CredentialMetadataRegistry.sol";
import {DIDRegistry} from "./DIDRegistry.sol";
import {RevocationRegistry} from "./RevocationRegistry.sol";
import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

contract CredentialVerifier {
    struct Groth16Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    error ZeroAddress();
    error InvalidProof(bytes32 credentialId);
    error CredentialRevoked(bytes32 credentialId, address issuer, uint256 revocationIndex);

    DIDRegistry public immutable didRegistry;
    RevocationRegistry public immutable revocationRegistry;
    CredentialMetadataRegistry public immutable credentialMetadataRegistry;
    IGroth16Verifier public immutable groth16Verifier;

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
        groth16Verifier = IGroth16Verifier(groth16Verifier_);
    }

    function validateCredential(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view returns (bool) {
        // This wrapper deliberately stays circuit-agnostic: the Groth16 verifier decides
        // whether the proof matches the public signals, while this contract enforces
        // on-chain credential state such as revocation.
        string memory issuerDID = credentialMetadataRegistry.getIssuerDID(credentialId);
        address issuer = credentialMetadataRegistry.getIssuer(credentialId);
        uint256 revocationIndex = credentialMetadataRegistry.getRevocationIndex(credentialId);
        issuerDID;

        if (revocationRegistry.isRevoked(issuer, revocationIndex)) {
            return false;
        }

        return groth16Verifier.verifyProof(proof.a, proof.b, proof.c, publicSignals);
    }

    function verifyPresentationOrRevert(
        bytes32 credentialId,
        Groth16Proof calldata proof,
        uint256[] calldata publicSignals
    ) external view returns (bool) {
        (, address issuer, uint256 revocationIndex) = credentialMetadataRegistry.getCredential(credentialId);

        if (revocationRegistry.isRevoked(issuer, revocationIndex)) {
            revert CredentialRevoked(credentialId, issuer, revocationIndex);
        }

        if (!groth16Verifier.verifyProof(proof.a, proof.b, proof.c, publicSignals)) {
            revert InvalidProof(credentialId);
        }

        return true;
    }

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
