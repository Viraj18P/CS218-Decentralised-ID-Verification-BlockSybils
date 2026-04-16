// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

contract RevocationRegistryTest is Test {
    RevocationRegistry private registry;

    address private constant ISSUER_A = address(0xA11CE);
    address private constant ISSUER_B = address(0xB0B);

    function setUp() public {
        registry = new RevocationRegistry();
    }

    function testRevokeAndUnrevoke() public {
        uint256 index = 42;

        assertFalse(registry.isRevoked(ISSUER_A, index));

        vm.prank(ISSUER_A);
        registry.revoke(index);
        assertTrue(registry.isRevoked(ISSUER_A, index));

        vm.prank(ISSUER_A);
        registry.unrevoke(index);
        assertFalse(registry.isRevoked(ISSUER_A, index));
    }

    function testDifferentIssuersHaveIndependentBitmaps() public {
        vm.prank(ISSUER_A);
        registry.revoke(12);

        assertTrue(registry.isRevoked(ISSUER_A, 12));
        assertFalse(registry.isRevoked(ISSUER_B, 12));
    }

    function testCannotRevokeTwice() public {
        vm.prank(ISSUER_A);
        registry.revoke(7);

        vm.prank(ISSUER_A);
        vm.expectRevert(abi.encodeWithSelector(RevocationRegistry.AlreadyRevoked.selector, ISSUER_A, 7));
        registry.revoke(7);
    }

    function testCannotUnrevokeClearBit() public {
        vm.prank(ISSUER_A);
        vm.expectRevert(abi.encodeWithSelector(RevocationRegistry.NotRevoked.selector, ISSUER_A, 8));
        registry.unrevoke(8);
    }

    function testBitmapHandlesBucketBoundary() public {
        vm.startPrank(ISSUER_A);
        registry.revoke(255);
        registry.revoke(256);
        vm.stopPrank();

        assertTrue(registry.isRevoked(ISSUER_A, 255));
        assertTrue(registry.isRevoked(ISSUER_A, 256));
        assertTrue((registry.getBucket(ISSUER_A, 0)) != 0);
        assertTrue((registry.getBucket(ISSUER_A, 1)) != 0);
    }

    function testIssuerIsolationOnUnrevoke() public {
        vm.prank(ISSUER_A);
        registry.revoke(10);

        vm.prank(ISSUER_B);
        vm.expectRevert(
            abi.encodeWithSelector(RevocationRegistry.NotRevoked.selector, ISSUER_B, 10)
        );
        registry.unrevoke(10);
    }
}