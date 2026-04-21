// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {CredentialMetadataRegistry} from "../src/CredentialMetadataRegistry.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {KYCGatedAuction} from "../src/KYCGatedAuction.sol";

// ============================================================================
// DIDRegistry — cover updatePublicKey, all getter helpers, error branches
// ============================================================================
contract DIDCoverageTest is Test {
    DIDRegistry private reg;

    address private constant ISSUER = address(0xA11CE);
    address private constant USER   = address(0xBEEF);

    bytes   private constant PUB_KEY = hex"04aabbccddeeff";
    string  private constant DID_STR = "did:example:issuer-1";

    function setUp() public {
        reg = new DIDRegistry();
        vm.prank(ISSUER);
        reg.registerDid(DID_STR, PUB_KEY);
    }

    // updatePublicKey — happy path
    function testUpdatePublicKeySucceeds() public {
        bytes memory newKey = hex"deadbeef";
        vm.prank(ISSUER);
        reg.updatePublicKey(DID_STR, newKey);
        assertEq(reg.getPublicKey(DID_STR), newKey);
    }

    function testUpdatePublicKeyRevertsIfNotOwner() public {
        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.Unauthorized.selector));
        reg.updatePublicKey(DID_STR, hex"1234");
    }

    function testUpdatePublicKeyRevertsOnEmptyKey() public {
        vm.prank(ISSUER);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.EmptyPublicKey.selector));
        reg.updatePublicKey(DID_STR, "");
    }

    function testUpdatePublicKeyRevertsOnUnknownDid() public {
        vm.prank(ISSUER);
        vm.expectRevert();
        reg.updatePublicKey("did:example:unknown", hex"1234");
    }

    // registerDid error branches
    function testRegisterDidRevertsOnEmptyDid() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.EmptyDID.selector));
        reg.registerDid("", PUB_KEY);
    }

    function testRegisterDidRevertsOnEmptyKey() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.EmptyPublicKey.selector));
        reg.registerDid("did:example:new", "");
    }

    function testRegisterDidRevertsOnDuplicate() public {
        vm.prank(ISSUER);
        vm.expectRevert();
        reg.registerDid(DID_STR, PUB_KEY);
    }

    // Uncovered getters
    function testGetPublicKeyByHash() public view {
        bytes32 h = reg.computeDidHash(DID_STR);
        assertEq(reg.getPublicKeyByHash(h), PUB_KEY);
    }

    function testGetOwnerByHash() public view {
        bytes32 h = reg.computeDidHash(DID_STR);
        assertEq(reg.getOwnerByHash(h), ISSUER);
    }

    function testGetDocument() public view {
        (address owner, bytes memory key, uint256 ts) = reg.getDocument(DID_STR);
        assertEq(owner, ISSUER);
        assertEq(key, PUB_KEY);
        assertGt(ts, 0);
    }

    function testGetUpdatedTimestamp() public view {
        assertGt(reg.getUpdatedTimestamp(DID_STR), 0);
    }

    function testIsRegisteredTrueAndFalse() public view {
        assertTrue(reg.isRegistered(DID_STR));
        assertFalse(reg.isRegistered("did:example:nope"));
    }

    function testComputeDidHash() public view {
        bytes32 h = reg.computeDidHash(DID_STR);
        assertEq(h, keccak256(abi.encodePacked(DID_STR)));
    }

    function testGetPublicKeyRevertsOnUnknownDid() public {
        vm.expectRevert();
        reg.getPublicKey("did:unknown");
    }
}

// ============================================================================
// KYCGatedAuction — cover endAuction, withdrawRefund, withdrawProceeds
// ============================================================================
contract KYCAuctionCoverageTest is Test {
    IdentityRegistry private identityReg;
    KYCGatedAuction  private auction;

    address private constant USER  = address(0xBEEF);
    address private constant USER2 = address(0xCAFE);

    function setUp() public {
        identityReg = new IdentityRegistry(address(this));
        auction     = new KYCGatedAuction(address(identityReg), address(this));

        vm.deal(USER,  10 ether);
        vm.deal(USER2, 10 ether);

        vm.prank(USER);
        identityReg.registerIdentity(keccak256("user-doc"));
        identityReg.verifyIdentity(USER);

        vm.prank(USER2);
        identityReg.registerIdentity(keccak256("user2-doc"));
        identityReg.verifyIdentity(USER2);
    }

    function testEndAuction() public {
        vm.prank(USER);
        auction.placeBid{value: 1 ether}();
        auction.endAuction();
        assertTrue(auction.ended());
    }

    function testEndAuctionRevertsIfAlreadyEnded() public {
        auction.endAuction();
        vm.expectRevert("Auction already ended");
        auction.endAuction();
    }

    function testPlaceBidRevertsAfterAuctionEnded() public {
        auction.endAuction();
        vm.prank(USER);
        vm.expectRevert("Auction already ended");
        auction.placeBid{value: 1 ether}();
    }

    function testWithdrawRefund() public {
        vm.prank(USER);
        auction.placeBid{value: 1 ether}();

        vm.prank(USER2);
        auction.placeBid{value: 2 ether}();

        uint256 balBefore = USER.balance;

        vm.prank(USER);
        auction.withdrawRefund();

        assertEq(USER.balance,               balBefore + 1 ether);
        assertEq(auction.pendingReturns(USER), 0);
    }

    function testWithdrawRefundRevertsWithNoFunds() public {
        vm.prank(USER);
        vm.expectRevert("No funds to withdraw");
        auction.withdrawRefund();
    }

    function testWithdrawProceeds() public {
        vm.prank(USER);
        auction.placeBid{value: 3 ether}();
        auction.endAuction();

        address payable recipient = payable(address(0x1234));
        uint256 balBefore = recipient.balance;
        auction.withdrawProceeds(recipient);
        assertEq(recipient.balance, balBefore + 3 ether);
    }

    function testWithdrawProceedsRevertsIfNotEnded() public {
        vm.prank(USER);
        auction.placeBid{value: 1 ether}();
        vm.expectRevert("Auction not ended");
        auction.withdrawProceeds(payable(address(0x1234)));
    }

    function testWithdrawProceedsRevertsOnZeroRecipient() public {
        auction.endAuction();
        vm.expectRevert("Recipient cannot be zero");
        auction.withdrawProceeds(payable(address(0)));
    }

    function testOnlyOwnerCanEndAuction() public {
        vm.prank(USER);
        vm.expectRevert();
        auction.endAuction();
    }

    function testConstructorRevertsOnZeroRegistry() public {
        vm.expectRevert("Registry cannot be zero");
        new KYCGatedAuction(address(0), address(this));
    }
}

// ============================================================================
// CredentialMetadataRegistry — cover convenience getters + error branches
// ============================================================================
contract CredentialMetadataCoverageTest is Test {
    DIDRegistry                private didReg;
    CredentialMetadataRegistry private metaReg;

    address private constant ISSUER = address(0xA11CE);
    bytes   private constant PUB_KEY = hex"04aabbccddeeff";
    string  private constant DID_STR = "did:example:issuer-1";

    bytes32 private constant CRED_ID = keccak256("cred-1");

    function setUp() public {
        didReg  = new DIDRegistry();
        metaReg = new CredentialMetadataRegistry(address(didReg));

        vm.prank(ISSUER);
        didReg.registerDid(DID_STR, PUB_KEY);

        vm.prank(ISSUER);
        metaReg.registerCredential(CRED_ID, DID_STR, 42);
    }

    function testConstructorRevertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(CredentialMetadataRegistry.ZeroAddress.selector));
        new CredentialMetadataRegistry(address(0));
    }

    function testRegisterCredentialRevertsOnZeroId() public {
        vm.prank(ISSUER);
        vm.expectRevert(abi.encodeWithSelector(CredentialMetadataRegistry.InvalidCredentialId.selector));
        metaReg.registerCredential(bytes32(0), DID_STR, 1);
    }

    function testGetIssuerDID() public view {
        assertEq(metaReg.getIssuerDID(CRED_ID), DID_STR);
    }

    function testGetIssuer() public view {
        assertEq(metaReg.getIssuer(CRED_ID), ISSUER);
    }

    function testGetRevocationIndex() public view {
        assertEq(metaReg.getRevocationIndex(CRED_ID), 42);
    }

    function testExistsReturnsTrueForRegistered() public view {
        assertTrue(metaReg.exists(CRED_ID));
    }

    function testExistsReturnsFalseForUnknown() public view {
        assertFalse(metaReg.exists(keccak256("unknown")));
    }

    function testGetCredentialRevertsOnUnknownId() public {
        bytes32 unknownId = keccak256("nope");
        vm.expectRevert(
            abi.encodeWithSelector(CredentialMetadataRegistry.CredentialNotFound.selector, unknownId)
        );
        metaReg.getCredential(unknownId);
    }
}

// ============================================================================
// RevocationRegistry — cover unrevoke + getBucket
// ============================================================================
contract RevocationCoverageTest is Test {
    RevocationRegistry private reg;

    address private constant ISSUER = address(0xA11CE);
    uint256 private constant IDX    = 42;

    function setUp() public {
        reg = new RevocationRegistry();
    }

    function testUnrevokeSucceeds() public {
        vm.startPrank(ISSUER);
        reg.revoke(IDX);
        assertTrue(reg.isRevoked(ISSUER, IDX));

        reg.unrevoke(IDX);
        assertFalse(reg.isRevoked(ISSUER, IDX));
        vm.stopPrank();
    }

    function testUnrevokeRevertsIfNotRevoked() public {
        vm.prank(ISSUER);
        vm.expectRevert(abi.encodeWithSelector(RevocationRegistry.NotRevoked.selector, ISSUER, IDX));
        reg.unrevoke(IDX);
    }

    function testGetBucket() public {
        vm.prank(ISSUER);
        reg.revoke(IDX);
        // IDX = 42 → bucket = 42>>8 = 0, mask = 1<<42
        uint256 word = reg.getBucket(ISSUER, 0);
        assertEq(word, uint256(1) << 42);
    }

    function testCanUnrevokeAndRevokeAgain() public {
        vm.startPrank(ISSUER);
        reg.revoke(IDX);
        reg.unrevoke(IDX);
        reg.revoke(IDX);
        assertTrue(reg.isRevoked(ISSUER, IDX));
        vm.stopPrank();
    }
}

// ============================================================================
// IdentityRegistry — cover addVerifier, removeVerifier, getDocumentHash,
//                    getStatus, constructor guard, and all revert branches
// ============================================================================
contract IdentityRegistryCoverageTest is Test {
    IdentityRegistry private reg;

    address private constant ADMIN    = address(0xAD);
    address private constant VERIFIER = address(0xFE);
    address private constant USER     = address(0xBEEF);

    function setUp() public {
        reg = new IdentityRegistry(ADMIN);
    }

    function testConstructorRevertsOnZeroAdmin() public {
        vm.expectRevert("Initial admin cannot be zero");
        new IdentityRegistry(address(0));
    }

    function testAddVerifier() public {
        vm.prank(ADMIN);
        reg.addVerifier(VERIFIER);
        assertTrue(reg.hasRole(reg.VERIFIER_ROLE(), VERIFIER));
    }

    function testAddVerifierRevertsForNonAdmin() public {
        vm.prank(USER);
        vm.expectRevert();
        reg.addVerifier(VERIFIER);
    }

    function testAddVerifierRevertsOnZeroAddress() public {
        vm.prank(ADMIN);
        vm.expectRevert("Verifier cannot be zero");
        reg.addVerifier(address(0));
    }

    function testRemoveVerifier() public {
        vm.startPrank(ADMIN);
        reg.addVerifier(VERIFIER);
        reg.removeVerifier(VERIFIER);
        vm.stopPrank();
        assertFalse(reg.hasRole(reg.VERIFIER_ROLE(), VERIFIER));
    }

    function testRemoveVerifierRevertsForNonAdmin() public {
        vm.prank(USER);
        vm.expectRevert();
        reg.removeVerifier(ADMIN);
    }

    function testRemoveVerifierRevertsOnZeroAddress() public {
        vm.prank(ADMIN);
        vm.expectRevert("Verifier cannot be zero");
        reg.removeVerifier(address(0));
    }

    function testGetDocumentHash() public {
        bytes32 hash = keccak256("my-doc");
        vm.prank(USER);
        reg.registerIdentity(hash);
        assertEq(reg.getDocumentHash(USER), hash);
    }

    function testGetDocumentHashRevertsIfNotRegistered() public {
        vm.expectRevert("Identity not registered");
        reg.getDocumentHash(USER);
    }

    function testGetStatus() public {
        assertEq(uint256(reg.getStatus(USER)), 0); // NotRegistered

        vm.prank(USER);
        reg.registerIdentity(keccak256("doc"));
        assertEq(uint256(reg.getStatus(USER)), 1); // Pending

        vm.prank(ADMIN);
        reg.verifyIdentity(USER);
        assertEq(uint256(reg.getStatus(USER)), 2); // Verified
    }

    function testVerifyRevertsOnZeroAddress() public {
        vm.prank(ADMIN);
        vm.expectRevert("User cannot be zero");
        reg.verifyIdentity(address(0));
    }

    function testVerifyRevertsIfNotRegistered() public {
        vm.prank(ADMIN);
        vm.expectRevert("Identity not registered");
        reg.verifyIdentity(USER);
    }

    function testVerifyRevertsIfAlreadyVerified() public {
        vm.prank(USER);
        reg.registerIdentity(keccak256("doc"));

        vm.prank(ADMIN);
        reg.verifyIdentity(USER);

        vm.prank(ADMIN);
        vm.expectRevert("Identity is not pending");
        reg.verifyIdentity(USER);
    }

    function testRevokeRevertsOnZeroAddress() public {
        vm.prank(ADMIN);
        vm.expectRevert("User cannot be zero");
        reg.revokeIdentity(address(0));
    }

    function testRevokeRevertsIfNotRegistered() public {
        vm.prank(ADMIN);
        vm.expectRevert("Identity not registered");
        reg.revokeIdentity(USER);
    }

    function testRevokeRevertsIfAlreadyRevoked() public {
        vm.prank(USER);
        reg.registerIdentity(keccak256("doc"));

        vm.prank(ADMIN);
        reg.verifyIdentity(USER);

        vm.prank(ADMIN);
        reg.revokeIdentity(USER);

        vm.prank(ADMIN);
        vm.expectRevert("Identity already revoked");
        reg.revokeIdentity(USER);
    }

    /// @notice RUBRIC: "Non-verifier cannot approve identities"
    function testNonVerifierCannotVerifyIdentity() public {
        vm.prank(USER);
        reg.registerIdentity(keccak256("doc"));

        // USER has no VERIFIER_ROLE — calling verifyIdentity must revert
        vm.prank(USER);
        vm.expectRevert(); // AccessControlUnauthorizedAccount
        reg.verifyIdentity(USER);
    }

    /// @notice RUBRIC: "Revoking verified identity changes status to Revoked"
    function testRevokeChangesStatusToRevoked() public {
        vm.prank(USER);
        reg.registerIdentity(keccak256("doc"));

        vm.prank(ADMIN);
        reg.verifyIdentity(USER);
        assertEq(uint256(reg.getStatus(USER)), 2); // Verified

        vm.prank(ADMIN);
        reg.revokeIdentity(USER);
        assertEq(uint256(reg.getStatus(USER)), 3); // Revoked
        assertFalse(reg.isVerified(USER));
    }

    /// @notice RUBRIC: "Non-verifier cannot revoke identities"
    function testNonVerifierCannotRevokeIdentity() public {
        vm.prank(USER);
        reg.registerIdentity(keccak256("doc"));

        vm.prank(ADMIN);
        reg.verifyIdentity(USER);

        // USER has no VERIFIER_ROLE — calling revokeIdentity must revert
        vm.prank(USER);
        vm.expectRevert(); // AccessControlUnauthorizedAccount
        reg.revokeIdentity(USER);
    }
}
