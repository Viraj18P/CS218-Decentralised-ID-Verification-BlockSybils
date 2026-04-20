// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";

contract DIDRegistryTest is Test {
    IdentityRegistry registry;

    event IdentityRegistered(address indexed user, bytes32 indexed documentHash, uint64 registeredAt);

    address user = address(1);
    address anotherUser = address(2);

    function setUp() public {
        registry = new IdentityRegistry(address(this));
    }


    function testRegisterIdentityStoresCorrectData() public {
        bytes32 hash = keccak256("user-doc");

        vm.prank(user);
        registry.registerIdentity(hash);

        (bytes32 storedHash, IdentityRegistry.Status status, address verifiedBy,,,) = registry.getIdentity(user);

        assertEq(storedHash, hash);
        assertEq(uint256(status), 1); // Pending
        assertEq(verifiedBy, address(0));
    }

    function testRegisterIdentityEmitsEvent() public {
        bytes32 hash = keccak256("doc");

        vm.prank(user);

        vm.expectEmit(true, true, false, false);
        emit IdentityRegistered(user, hash, 0);

        registry.registerIdentity(hash);
    }

    function testCannotRegisterTwice() public {
        bytes32 hash = keccak256("doc");

        vm.startPrank(user);
        registry.registerIdentity(hash);

        vm.expectRevert();
        registry.registerIdentity(hash);
        vm.stopPrank();
    }

    function testRegisterWithZeroHashReverts() public {
        vm.prank(user);
        vm.expectRevert();
        registry.registerIdentity(bytes32(0));
    }



    function testUnregisteredUserNotVerified() public {
        bool verified = registry.isVerified(user);
        assertEq(verified, false);
    }

    function testRegisteredUserNotVerifiedInitially() public {
        vm.prank(user);
        registry.registerIdentity(keccak256("doc"));

        bool verified = registry.isVerified(user);
        assertEq(verified, false);
    }


    function testDifferentUsersIndependent() public {
        vm.prank(user);
        registry.registerIdentity(keccak256("doc1"));

        vm.prank(anotherUser);
        registry.registerIdentity(keccak256("doc2"));

        (bytes32 hash1,,,,,) = registry.getIdentity(user);
        (bytes32 hash2,,,,,) = registry.getIdentity(anotherUser);

        assertTrue(hash1 != hash2);
    }
}
