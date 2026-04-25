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


    function setUp() public {
        registry = new RevocationRegistry();
    }


    function testRevokeMarksCredentialAsRevoked() public {
        vm.prank(ISSUER);
        registry.revoke(INDEX);

        bool revoked = registry.isRevoked(ISSUER, INDEX);
        assertTrue(revoked);
    }

    function testIsRevokedReturnsFalseInitially() public view{
        bool revoked = registry.isRevoked(ISSUER, INDEX);
        assertFalse(revoked);
    }

    function testRevokeMultipleIndexes() public {
        vm.startPrank(ISSUER);

        registry.revoke(1);
        registry.revoke(2);
        registry.revoke(3);

        vm.stopPrank();

        assertTrue(registry.isRevoked(ISSUER, 1));
        assertTrue(registry.isRevoked(ISSUER, 2));
        assertTrue(registry.isRevoked(ISSUER, 3));
    }

    function testRevokeSameIndexTwice() public {
        vm.startPrank(ISSUER);

        registry.revoke(INDEX);
        vm.expectRevert(abi.encodeWithSelector(RevocationRegistry.AlreadyRevoked.selector, ISSUER, INDEX));
        registry.revoke(INDEX);

        vm.stopPrank();

        assertTrue(registry.isRevoked(ISSUER, INDEX));
    }


    function testUnauthorizedUserCanRevokeOrNot() public {
        // depends on your contract design:
        // If only issuer/admin can revoke, expectRevert
        // If open revocation, should pass

        vm.prank(ATTACKER);

        

        // vm.expectRevert();
        registry.revoke(INDEX);

        bool revoked = registry.isRevoked(ATTACKER, INDEX);
        assertTrue(revoked);
    }



    function testUnknownIndexNotRevoked() public view {
        bool revoked = registry.isRevoked(ISSUER, UNKNOWN_INDEX);
        assertFalse(revoked);
    }


    function testFuzz_Revoke(uint256 x) public {
        vm.prank(ISSUER);
        registry.revoke(x);

        assertTrue(registry.isRevoked(ISSUER, x));
    }
}
