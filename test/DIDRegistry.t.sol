// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";

contract DIDRegistryTest is Test {
    IdentityRegistry registry;

    // New event signature (verifier + ipfsCid + filename added)
    event IdentityRegistered(
        address indexed user,
        address indexed verifier,
        bytes32 indexed documentHash,
        string  ipfsCid,
        string  filename,
        uint64  registeredAt
    );

    address user        = address(1);
    address anotherUser = address(2);

    function setUp() public {
        // address(this) becomes admin + gets VERIFIER_ROLE
        registry = new IdentityRegistry(address(this));
    }

    // Helper: register with address(this) as assignedVerifier (only default verifier in tests)
    function _register(address who, bytes32 hash) internal {
        vm.prank(who);
        registry.registerIdentity(address(this), hash, "ipfs://test", "test.pdf");
    }

    function testRegisterIdentityStoresCorrectData() public {
        bytes32 hash = keccak256("user-doc");
        _register(user, hash);

        // getIdentity now returns 10 values
        (
            bytes32 storedHash,
            IdentityRegistry.Status status,
            address verifiedBy,
            ,,,,,, // revokedBy, assignedVerifier, registeredAt, verifiedAt, revokedAt, ipfsCid, filename
        ) = registry.getIdentity(user);

        assertEq(storedHash, hash);
        assertEq(uint256(status), 1); // Pending
        assertEq(verifiedBy, address(0));
    }

    function testRegisterIdentityEmitsEvent() public {
        bytes32 hash = keccak256("doc");
        vm.prank(user);
        // Only check first two indexed topics (user + verifier)
        vm.expectEmit(true, true, false, false);
        emit IdentityRegistered(user, address(this), hash, "", "", 0);
        registry.registerIdentity(address(this), hash, "ipfs://doc", "doc.pdf");
    }

    function testCannotRegisterTwice() public {
        bytes32 hash = keccak256("doc");
        vm.startPrank(user);
        registry.registerIdentity(address(this), hash, "ipfs://doc", "doc.pdf");
        vm.expectRevert();
        registry.registerIdentity(address(this), hash, "ipfs://doc", "doc.pdf");
        vm.stopPrank();
    }

    function testRegisterWithZeroHashReverts() public {
        vm.prank(user);
        vm.expectRevert();
        registry.registerIdentity(address(this), bytes32(0), "ipfs://doc", "doc.pdf");
    }

    function testUnregisteredUserNotVerified() public view {
        assertEq(registry.isVerified(user), false);
    }

    function testRegisteredUserNotVerifiedInitially() public {
        _register(user, keccak256("doc"));
        assertEq(registry.isVerified(user), false);
    }

    function testDifferentUsersIndependent() public {
        _register(user,        keccak256("doc1"));
        _register(anotherUser, keccak256("doc2"));

        (bytes32 hash1,,,,,,,,,) = registry.getIdentity(user);
        (bytes32 hash2,,,,,,,,,) = registry.getIdentity(anotherUser);
        assertTrue(hash1 != hash2);
    }
}
