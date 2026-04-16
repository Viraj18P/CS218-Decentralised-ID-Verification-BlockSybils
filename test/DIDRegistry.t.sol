// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";

contract DIDRegistryTest is Test {
    DIDRegistry private registry;

    address private constant ISSUER = address(0xA11CE);
    address private constant ATTACKER = address(0xB0B);
    string private constant ISSUER_DID = "did:example:issuer-1";

    bytes private issuerKey;
    bytes private updatedKey;

    function setUp() public {
        registry = new DIDRegistry();
        issuerKey = hex"1122334455667788";
        updatedKey = hex"aabbccdd";
    }

    function testRegisterDidStoresDocument() public {
        vm.prank(ISSUER);
        registry.registerDid(ISSUER_DID, issuerKey);

        (address owner, bytes memory publicKey, uint256 updatedTimestamp) = registry.getDocument(ISSUER_DID);
        assertEq(owner, ISSUER);
        assertEq(publicKey, issuerKey);
        assertTrue(updatedTimestamp > 0);
    }

    function testOnlyOwnerCanUpdatePublicKey() public {
        vm.prank(ISSUER);
        registry.registerDid(ISSUER_DID, issuerKey);

        vm.prank(ATTACKER);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.Unauthorized.selector));
        registry.updatePublicKey(ISSUER_DID, updatedKey);
    }

    function testUpdatePublicKey() public {
        vm.prank(ISSUER);
        registry.registerDid(ISSUER_DID, issuerKey);
        uint256 registeredAt = registry.getUpdatedTimestamp(ISSUER_DID);

        vm.prank(ISSUER);
        registry.updatePublicKey(ISSUER_DID, updatedKey);

        assertEq(registry.getPublicKey(ISSUER_DID), updatedKey);
        assertTrue(registry.getUpdatedTimestamp(ISSUER_DID) >= registeredAt);
    }

    function testCannotOverwriteExistingDID() public {
        vm.prank(ISSUER);
        registry.registerDid(ISSUER_DID, issuerKey);

        vm.prank(ISSUER);
        vm.expectRevert(
            abi.encodeWithSelector(DIDRegistry.DIDAlreadyRegistered.selector, keccak256(bytes(ISSUER_DID)))
        );
        registry.registerDid(ISSUER_DID, issuerKey);
    }

    function testCannotRegisterEmptyDid() public {
        vm.prank(ISSUER);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.EmptyDID.selector));
        registry.registerDid("", issuerKey);
    }

    function testCannotRegisterEmptyPublicKey() public {
        vm.prank(ISSUER);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.EmptyPublicKey.selector));
        registry.registerDid(ISSUER_DID, bytes(""));
    }
}
