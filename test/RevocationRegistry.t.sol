// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

contract RevocationRegistryTest is Test {
    RevocationRegistry private registry;

    address private constant ISSUER = address(0xA11CE);
    address private constant ATTACKER = address(0xB0B);

    uint256 private constant INDEX = 77;
    uint256 private constant UNKNOWN_INDEX = 999;

    /*//////////////////////////////////////////////////////////////
                            SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        registry = new RevocationRegistry();
    }

    /*//////////////////////////////////////////////////////////////
                        SUCCESS CASES
    //////////////////////////////////////////////////////////////*/

    function testRevokeMarksCredentialAsRevoked() public {
        vm.prank(ISSUER);
        registry.revoke(INDEX);

        bool revoked = registry.isRevoked(INDEX);
        assertTrue(revoked);
    }

    function testIsRevokedReturnsFalseInitially() public {
        bool revoked = registry.isRevoked(INDEX);
        assertFalse(revoked);
    }

    /*//////////////////////////////////////////////////////////////
                        EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function testRevokeMultipleIndexes() public {
        vm.startPrank(ISSUER);

        registry.revoke(1);
        registry.revoke(2);
        registry.revoke(3);

        vm.stopPrank();

        assertTrue(registry.isRevoked(1));
        assertTrue(registry.isRevoked(2));
        assertTrue(registry.isRevoked(3));
    }

    function testRevokeSameIndexTwice() public {
        vm.startPrank(ISSUER);

        registry.revoke(INDEX);
        registry.revoke(INDEX); // should not break

        vm.stopPrank();

        assertTrue(registry.isRevoked(INDEX));
    }

    /*//////////////////////////////////////////////////////////////
                        SECURITY / FAILURE
    //////////////////////////////////////////////////////////////*/

    function testUnauthorizedUserCanRevokeOrNot() public {
        // ⚠️ depends on your contract design:
        // If only issuer/admin can revoke → expectRevert
        // If open revocation → should pass

        vm.prank(ATTACKER);

        // Uncomment ONE based on actual contract:

        // vm.expectRevert();
        registry.revoke(INDEX);

        bool revoked = registry.isRevoked(INDEX);
        assertTrue(revoked);
    }

    /*//////////////////////////////////////////////////////////////
                        UNKNOWN / DEFAULT
    //////////////////////////////////////////////////////////////*/

    function testUnknownIndexNotRevoked() public {
        bool revoked = registry.isRevoked(UNKNOWN_INDEX);
        assertFalse(revoked);
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TEST (coverage boost)
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Revoke(uint256 x) public {
        vm.prank(ISSUER);
        registry.revoke(x);

        assertTrue(registry.isRevoked(x));
    }
}