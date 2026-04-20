// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CredentialMetadataRegistry} from "../src/CredentialMetadataRegistry.sol";
import {CredentialVerifier} from "../src/CredentialVerifier.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {MockGroth16Verifier} from "../mocks/MockGroth16Verifier.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

contract CredentialVerifierTest is Test {
    DIDRegistry private didRegistry;
    RevocationRegistry private revocationRegistry;
    CredentialMetadataRegistry private credentialMetadataRegistry;
    MockGroth16Verifier private groth16Verifier;
    CredentialVerifier private verifierWrapper;

    address private constant ISSUER = address(0xA11CE);
    address private constant ATTACKER = address(0xB0B);
    address private constant RANDOM = address(0xC0FFEE);

    bytes32 private constant CREDENTIAL_ID = keccak256("credential-1");
    bytes32 private constant UNKNOWN_ID = keccak256("unknown");

    string private constant ISSUER_DID = "did:example:issuer-1";

    bytes private issuerPublicKey;

    /*//////////////////////////////////////////////////////////////
                            SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        issuerPublicKey = hex"04aabbccddeeff";

        didRegistry = new DIDRegistry();
        revocationRegistry = new RevocationRegistry();
        credentialMetadataRegistry = new CredentialMetadataRegistry(address(didRegistry));
        groth16Verifier = new MockGroth16Verifier();

        verifierWrapper = new CredentialVerifier(
            address(didRegistry),
            address(revocationRegistry),
            address(credentialMetadataRegistry),
            address(groth16Verifier)
        );

        // Register issuer DID
        vm.prank(ISSUER);
        didRegistry.registerDid(ISSUER_DID, issuerPublicKey);

        // Register credential
        vm.prank(ISSUER);
        credentialMetadataRegistry.registerCredential(CREDENTIAL_ID, ISSUER_DID, 77);
    }

    /*//////////////////////////////////////////////////////////////
                    VALIDATION SUCCESS CASES
    //////////////////////////////////////////////////////////////*/

    function testValidateCredentialReturnsTrueForValidCredential() public {
        CredentialVerifier.Groth16Proof memory proof = _dummyProof();

        uint256[] memory publicSignals = new uint256[](2);
        publicSignals[0] = 1;
        publicSignals[1] = 77;

        bool result = verifierWrapper.validateCredential(CREDENTIAL_ID, proof, publicSignals);
        assertTrue(result);
    }

    /*//////////////////////////////////////////////////////////////
                    FAILURE CASES (IMPORTANT MARKS)
    //////////////////////////////////////////////////////////////*/

    function testValidateCredentialReturnsFalseWhenRevoked() public {
        vm.prank(ISSUER);
        revocationRegistry.revoke(77);

        CredentialVerifier.Groth16Proof memory proof = _dummyProof();

        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 77;

        bool result = verifierWrapper.validateCredential(CREDENTIAL_ID, proof, publicSignals);
        assertFalse(result);
    }

    function testValidateCredentialReturnsFalseWhenProofFails() public {
        groth16Verifier.setShouldVerify(false);

        CredentialVerifier.Groth16Proof memory proof = _dummyProof();

        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 77;

        bool result = verifierWrapper.validateCredential(CREDENTIAL_ID, proof, publicSignals);
        assertFalse(result);
    }

    function testValidateCredentialRevertsForUnknownCredential() public {
        CredentialVerifier.Groth16Proof memory proof = _dummyProof();

        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 77;

        vm.expectRevert(
            abi.encodeWithSelector(
                CredentialMetadataRegistry.CredentialNotFound.selector,
                UNKNOWN_ID
            )
        );

        verifierWrapper.validateCredential(UNKNOWN_ID, proof, publicSignals);
    }

    /*//////////////////////////////////////////////////////////////
                VERIFY PRESENTATION (REVERT TESTS)
    //////////////////////////////////////////////////////////////*/

    function testVerifyPresentationOrRevertFailsOnInvalidProof() public {
        groth16Verifier.setShouldVerify(false);

        CredentialVerifier.Groth16Proof memory proof = _dummyProof();

        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 77;

        vm.expectRevert(
            abi.encodeWithSelector(
                CredentialVerifier.InvalidProof.selector,
                CREDENTIAL_ID
            )
        );

        verifierWrapper.verifyPresentationOrRevert(CREDENTIAL_ID, proof, publicSignals);
    }

    function testVerifyPresentationOrRevertFailsWhenRevoked() public {
        vm.prank(ISSUER);
        revocationRegistry.revoke(77);

        CredentialVerifier.Groth16Proof memory proof = _dummyProof();

        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 77;

        vm.expectRevert(
            abi.encodeWithSelector(
                CredentialVerifier.CredentialRevoked.selector,
                CREDENTIAL_ID,
                ISSUER,
                77
            )
        );

        verifierWrapper.verifyPresentationOrRevert(CREDENTIAL_ID, proof, publicSignals);
    }

    /*//////////////////////////////////////////////////////////////
                    METADATA + CONTEXT TESTS
    //////////////////////////////////////////////////////////////*/

    function testResolveCredentialContextReturnsCorrectData() public {
        (
            string memory issuerDID,
            address issuer,
            bytes memory publicKey,
            uint256 revocationIndex,
            bool revoked
        ) = verifierWrapper.resolveCredentialContext(CREDENTIAL_ID);

        assertEq(issuerDID, ISSUER_DID);
        assertEq(issuer, ISSUER);
        assertEq(publicKey, issuerPublicKey);
        assertEq(revocationIndex, 77);
        assertFalse(revoked);
    }

    /*//////////////////////////////////////////////////////////////
                    METADATA REGISTRY EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function testCannotRegisterDuplicateCredentialId() public {
        vm.prank(ISSUER);

        vm.expectRevert(
            abi.encodeWithSelector(
                CredentialMetadataRegistry.CredentialAlreadyRegistered.selector,
                CREDENTIAL_ID
            )
        );

        credentialMetadataRegistry.registerCredential(CREDENTIAL_ID, ISSUER_DID, 90);
    }

    function testCredentialRegistrationRequiresDidOwnership() public {
        bytes32 secondCredentialId = keccak256("credential-2");

        vm.prank(ATTACKER);

        vm.expectRevert(
            abi.encodeWithSelector(
                CredentialMetadataRegistry.CallerNotDidOwner.selector,
                ATTACKER,
                ISSUER
            )
        );

        credentialMetadataRegistry.registerCredential(secondCredentialId, ISSUER_DID, 88);
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ / EXTRA COVERAGE
    //////////////////////////////////////////////////////////////*/

    function testFuzz_PublicSignals(uint256 x) public {
        CredentialVerifier.Groth16Proof memory proof = _dummyProof();

        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = x;

        verifierWrapper.validateCredential(CREDENTIAL_ID, proof, publicSignals);
    }

    /*//////////////////////////////////////////////////////////////
                        HELPER
    //////////////////////////////////////////////////////////////*/

    function _dummyProof()
        private
        pure
        returns (CredentialVerifier.Groth16Proof memory proof)
    {
        proof.a[0] = 1;
        proof.a[1] = 2;

        proof.b[0][0] = 3;
        proof.b[0][1] = 4;
        proof.b[1][0] = 5;
        proof.b[1][1] = 6;

        proof.c[0] = 7;
        proof.c[1] = 8;
    }
}