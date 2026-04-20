// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DIDRegistry.sol";

contract DIDRegistryTest is Test {
    DIDRegistry registry;

    address user = address(1);
    address anotherUser = address(2);

    function setUp() public {
        registry = new DIDRegistry();
    }

    /*//////////////////////////////////////////////////////////////
                        REGISTER TESTS
    //////////////////////////////////////////////////////////////*/

    function testRegisterIdentityStoresCorrectData() public {
        bytes32 hash = keccak256("user-doc");

        vm.prank(user);
        registry.registerIdentity(hash);

        (bytes32 storedHash, uint status, address verifiedBy) = registry.identities(user);

        assertEq(storedHash, hash);
        assertEq(status, 1); // Pending (adjust if enum differs)
        assertEq(verifiedBy, address(0));
    }

    function testRegisterIdentityEmitsEvent() public {
        bytes32 hash = keccak256("doc");

        vm.prank(user);

        vm.expectEmit(true, false, false, true);
        emit IdentityRegistered(user, hash); // adjust if event name differs

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

    /*//////////////////////////////////////////////////////////////
                        VERIFICATION STATUS
    //////////////////////////////////////////////////////////////*/

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

    /*//////////////////////////////////////////////////////////////
                        EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function testDifferentUsersIndependent() public {
        vm.prank(user);
        registry.registerIdentity(keccak256("doc1"));

        vm.prank(anotherUser);
        registry.registerIdentity(keccak256("doc2"));

        (bytes32 hash1,,) = registry.identities(user);
        (bytes32 hash2,,) = registry.identities(anotherUser);

        assertTrue(hash1 != hash2);
    }
}