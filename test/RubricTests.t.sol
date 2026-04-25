// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}             from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {KYCGatedAuction}  from "../src/KYCGatedAuction.sol";

/**
 * @title RubricTests
 * @notice Directly maps to every bullet point in the CS218 marking rubric
 *         sections A (edge cases) and E (required tests).
 *
 *         Run:  forge test --match-contract RubricTests -vv
 *
 * Rubric E requirements covered here
 * ───────────────────────────────────
 *  ✓ Non-verifier cannot approve identities
 *  ✓ Unregistered user is not verified
 *  ✓ Revoking verified identity changes status to Revoked
 *  ✓ Composability: unverified address bid in KYCGatedAuction reverts
 *  ✓ After verification, same address can bid successfully
 *  ✓ Revert / failure test for each function (wrong caller, invalid input, wrong state)
 *
 * Rubric A edge cases covered here
 * ─────────────────────────────────
 *  ✓ Unregistered user not verified
 *  ✓ Revoking unregistered user reverts
 *  ✓ Non-verifier cannot approve
 *  ✓ Unverified address bid in KYCGatedAuction reverts
 */
contract RubricTests is Test {
    IdentityRegistry private registry;
    KYCGatedAuction  private auction;

    address private constant ADMIN    = address(0xAD);
    address private constant VERIFIER = address(0xFE);
    address private constant USER     = address(0xBEEF);
    address private constant STRANGER = address(0xDEAD);

    bytes32 private constant DOC_HASH = keccak256("user-passport");

    function setUp() public {
        // Deploy with ADMIN as the initial admin (also gets VERIFIER_ROLE by default)
        registry = new IdentityRegistry(ADMIN);
        auction  = new KYCGatedAuction(address(registry), ADMIN);

        // Grant a separate VERIFIER address for role-separation tests
        vm.prank(ADMIN);
        registry.addVerifier(VERIFIER);

        vm.deal(USER,    10 ether);
        vm.deal(STRANGER, 10 ether);
    }

    // ─── E: Unregistered user is not verified ────────────────────────────────

    /// @notice An address that has never called registerIdentity must return false.
    function test_unregisteredUser_isNotVerified() public view {
        assertFalse(registry.isVerified(USER));
    }

    /// @notice getStatus returns NotRegistered (0) for unknown addresses.
    function test_unregisteredUser_statusIsNotRegistered() public view {
        assertEq(uint256(registry.getStatus(USER)), 0);
    }

    // ─── E: Non-verifier cannot approve identities ───────────────────────────

    /// @notice STRANGER has no VERIFIER_ROLE — verifyIdentity must revert.
    function test_nonVerifier_cannotApprove() public {
        vm.prank(USER);
        registry.registerIdentity(DOC_HASH);

        vm.prank(STRANGER);
        vm.expectRevert(); // OZ AccessControlUnauthorizedAccount
        registry.verifyIdentity(USER);
    }

    /// @notice STRANGER cannot revoke either.
    function test_nonVerifier_cannotRevoke() public {
        _registerAndVerify(USER);

        vm.prank(STRANGER);
        vm.expectRevert();
        registry.revokeIdentity(USER);
    }

    // ─── A: Revoking unregistered user reverts ───────────────────────────────

    /// @notice revokeIdentity on an address that never registered must revert.
    function test_revokeUnregistered_reverts() public {
        vm.prank(VERIFIER);
        vm.expectRevert("Identity not registered");
        registry.revokeIdentity(USER);
    }

    // ─── E: Revoking verified identity changes status to Revoked ─────────────

    /// @notice After revokeIdentity, status must be Revoked (3) and isVerified false.
    function test_revokeVerified_changesStatusToRevoked() public {
        _registerAndVerify(USER);

        assertEq(uint256(registry.getStatus(USER)), 2); // Verified

        vm.prank(VERIFIER);
        registry.revokeIdentity(USER);

        assertEq(uint256(registry.getStatus(USER)), 3); // Revoked
        assertFalse(registry.isVerified(USER));
    }

    // ─── E: Composability — unverified bid reverts ───────────────────────────

    /// @notice A wallet with status Pending must be rejected by KYCGatedAuction.
    function test_composability_pendingUser_cannotBid() public {
        vm.prank(USER);
        registry.registerIdentity(DOC_HASH); // Pending, not Verified

        vm.prank(USER);
        vm.expectRevert("KYC required");
        auction.placeBid{value: 1 ether}();
    }

    /// @notice A wallet that never registered must be rejected.
    function test_composability_unregisteredUser_cannotBid() public {
        vm.prank(STRANGER);
        vm.expectRevert("KYC required");
        auction.placeBid{value: 1 ether}();
    }

    /// @notice A revoked wallet must be rejected even though it was verified before.
    function test_composability_revokedUser_cannotBid() public {
        _registerAndVerify(USER);

        vm.prank(VERIFIER);
        registry.revokeIdentity(USER);

        vm.prank(USER);
        vm.expectRevert("KYC required");
        auction.placeBid{value: 1 ether}();
    }

    // ─── E: After verification, same address can bid ─────────────────────────

    /// @notice Once verified, the address must be able to place a bid.
    function test_composability_verifiedUser_canBid() public {
        _registerAndVerify(USER);

        vm.prank(USER);
        auction.placeBid{value: 1 ether}();

        assertEq(auction.highestBidder(), USER);
        assertEq(auction.highestBid(),    1 ether);
    }

    // ─── E: Revert / failure tests for each function ─────────────────────────

    function test_registerIdentity_reverts_onZeroHash() public {
        vm.prank(USER);
        vm.expectRevert("Document hash cannot be empty");
        registry.registerIdentity(bytes32(0));
    }

    function test_registerIdentity_reverts_ifAlreadyRegistered() public {
        vm.prank(USER);
        registry.registerIdentity(DOC_HASH);

        vm.prank(USER);
        vm.expectRevert("Identity already registered");
        registry.registerIdentity(DOC_HASH);
    }

    function test_verifyIdentity_reverts_onNotRegistered() public {
        vm.prank(VERIFIER);
        vm.expectRevert("Identity not registered");
        registry.verifyIdentity(USER);
    }

    function test_verifyIdentity_reverts_ifAlreadyVerified() public {
        _registerAndVerify(USER);

        vm.prank(VERIFIER);
        vm.expectRevert("Identity is not pending");
        registry.verifyIdentity(USER);
    }

    function test_verifyIdentity_reverts_onZeroAddress() public {
        vm.prank(VERIFIER);
        vm.expectRevert("User cannot be zero");
        registry.verifyIdentity(address(0));
    }

    function test_revokeIdentity_reverts_ifAlreadyRevoked() public {
        _registerAndVerify(USER);

        vm.prank(VERIFIER);
        registry.revokeIdentity(USER);

        vm.prank(VERIFIER);
        vm.expectRevert("Identity already revoked");
        registry.revokeIdentity(USER);
    }

    function test_revokeIdentity_reverts_onZeroAddress() public {
        vm.prank(VERIFIER);
        vm.expectRevert("User cannot be zero");
        registry.revokeIdentity(address(0));
    }

    function test_placeBid_reverts_ifBidTooLow() public {
        _registerAndVerify(USER);
        _registerAndVerify(STRANGER);

        vm.prank(USER);
        auction.placeBid{value: 2 ether}();

        vm.prank(STRANGER);
        vm.expectRevert("Bid too low");
        auction.placeBid{value: 1 ether}();
    }

    function test_placeBid_reverts_afterAuctionEnded() public {
        _registerAndVerify(USER);

        vm.prank(ADMIN);
        auction.endAuction();

        vm.prank(USER);
        vm.expectRevert("Auction already ended");
        auction.placeBid{value: 1 ether}();
    }

    function test_endAuction_reverts_ifNotOwner() public {
        vm.prank(STRANGER);
        vm.expectRevert();
        auction.endAuction();
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    function _registerAndVerify(address user) internal {
        vm.prank(user);
        registry.registerIdentity(keccak256(abi.encodePacked("doc-of-", user)));

        vm.prank(VERIFIER);
        registry.verifyIdentity(user);
    }
}
