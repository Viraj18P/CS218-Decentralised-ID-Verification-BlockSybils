// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

contract IntegrationTest is Test {
    DIDRegistry private didRegistry;
    RevocationRegistry private revRegistry;

    address private constant ISSUER = address(0xA11CE);
    address private constant HOLDER = address(0xBEEF);

    string private constant ISSUER_DID = "did:example:issuer";

    bytes private issuerKey;

    function setUp() public {
        didRegistry = new DIDRegistry();
        revRegistry = new RevocationRegistry();
        issuerKey = hex"1234abcd";
    }

    function testFullCredentialLifecycle() public {
        uint256 credentialIndex = 5;

        // 1. Issuer registers DID
        vm.prank(ISSUER);
        didRegistry.registerDid(ISSUER_DID, issuerKey);

        // 2. Verifier checks issuer exists
        assertTrue(didRegistry.isRegistered(ISSUER_DID));

        // 3. Credential is initially NOT revoked
        assertFalse(revRegistry.isRevoked(ISSUER, credentialIndex));

        // 4. Issuer revokes credential
        vm.prank(ISSUER);
        revRegistry.revoke(credentialIndex);

        // 5. Verifier checks revocation
        assertTrue(revRegistry.isRevoked(ISSUER, credentialIndex));
    }

    function testVerifierRejectsRevokedCredential() public {
        uint256 credentialIndex = 10;

        vm.prank(ISSUER);
        didRegistry.registerDid(ISSUER_DID, issuerKey);

        vm.prank(ISSUER);
        revRegistry.revoke(credentialIndex);

        bool isValid = !revRegistry.isRevoked(ISSUER, credentialIndex);

        assertFalse(isValid);
    }
}