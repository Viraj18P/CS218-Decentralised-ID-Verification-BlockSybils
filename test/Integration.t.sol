// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {CredentialMetadataRegistry} from "../src/CredentialMetadataRegistry.sol";
import {CredentialVerifier} from "../src/CredentialVerifier.sol";
import {MockGroth16Verifier} from "../mocks/MockGroth16Verifier.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {KYCGatedAuction} from "../src/KYCGatedAuction.sol";

contract IntegrationTest is Test {
    DIDRegistry private didRegistry;
    RevocationRegistry private revocationRegistry;
    CredentialMetadataRegistry private metadataRegistry;
    MockGroth16Verifier private groth16Verifier;
    CredentialVerifier private verifierWrapper;
    IdentityRegistry private identityRegistry;
    KYCGatedAuction private auction;

    address private constant ISSUER = address(0xA11CE);
    address private constant USER = address(0xBEEF);
    address private constant OTHER = address(0xCAFE);

    bytes32 private constant CREDENTIAL_ID = keccak256("credential-1");
    string private constant ISSUER_DID = "did:example:issuer-1";

    bytes private issuerPublicKey;



    function setUp() public {
        issuerPublicKey = hex"04aabbccddeeff";

        didRegistry = new DIDRegistry();
        revocationRegistry = new RevocationRegistry();
        metadataRegistry = new CredentialMetadataRegistry(address(didRegistry));
        groth16Verifier = new MockGroth16Verifier();

        verifierWrapper = new CredentialVerifier(
            address(didRegistry),
            address(revocationRegistry),
            address(metadataRegistry),
            address(groth16Verifier)
        );

        identityRegistry = new IdentityRegistry(address(this));
        auction = new KYCGatedAuction(address(identityRegistry), address(this));

        // Fund users
        vm.deal(USER, 10 ether);
        vm.deal(OTHER, 10 ether);

        // Register issuer DID
        vm.prank(ISSUER);
        didRegistry.registerDid(ISSUER_DID, issuerPublicKey);

        // Register credential
        vm.prank(ISSUER);
        metadataRegistry.registerCredential(CREDENTIAL_ID, ISSUER_DID, 77);
    }


    function testUnverifiedUserCannotBid() public {
        vm.prank(USER);
        vm.expectRevert("KYC required");

        auction.placeBid{value: 1 ether}();
    }

    function testVerifiedUserCanBid() public {
        _verifyUser();

        vm.prank(USER);
        auction.placeBid{value: 1 ether}();

        assertEq(auction.highestBidder(), USER);
        assertEq(auction.highestBid(), 1 ether);
    }

    function testHigherBidReplacesPreviousBidder() public {
        _verifyUser();
        _verifyOther();

        vm.prank(USER);
        auction.placeBid{value: 1 ether}();

        vm.prank(OTHER);
        auction.placeBid{value: 2 ether}();

        assertEq(auction.highestBidder(), OTHER);
        assertEq(auction.highestBid(), 2 ether);
    }

    function testRevokedUserCannotBid() public {
        _verifyUser();

        identityRegistry.revokeIdentity(USER);

        vm.prank(USER);
        vm.expectRevert("KYC required");

        auction.placeBid{value: 1 ether}();
    }


    function testBidMustBeHigherThanPrevious() public {
        _verifyUser();

        vm.prank(USER);
        auction.placeBid{value: 2 ether}();

        vm.prank(USER);
        vm.expectRevert(); // adjust message if needed
        auction.placeBid{value: 1 ether}();
    }

    function testZeroBidReverts() public {
        _verifyUser();

        vm.prank(USER);
        vm.expectRevert();
        auction.placeBid{value: 0}();
    }



    function testMultipleUsersBiddingFlow() public {
        _verifyUser();
        _verifyOther();

        vm.prank(USER);
        auction.placeBid{value: 1 ether}();

        vm.prank(OTHER);
        auction.placeBid{value: 3 ether}();

        vm.prank(USER);
        auction.placeBid{value: 5 ether}();

        assertEq(auction.highestBidder(), USER);
        assertEq(auction.highestBid(), 5 ether);
    }



    function testFuzz_Bidding(uint256 amount) public {
        vm.assume(amount > 0 && amount < 10 ether);

        _verifyUser();

        vm.prank(USER);
        auction.placeBid{value: amount}();

        assertEq(auction.highestBid(), amount);
    }



    function _verifyUser() internal {
        vm.prank(USER);
        identityRegistry.registerIdentity(keccak256("user-doc"));

        identityRegistry.verifyIdentity(USER);
    }

    function _verifyOther() internal {
        vm.prank(OTHER);
        identityRegistry.registerIdentity(keccak256("other-doc"));

        identityRegistry.verifyIdentity(OTHER);
    }

    function _dummyProof()
        internal
        pure
        returns (CredentialVerifier.Groth16Proof memory proof)
    {
        proof.a[0] = 1;
        proof.a[1] = 2;

        proof.b[0][0] = 3;
        proof.b[0][1] = 4;
        proof.b[1][0] = 5;
        proof.b[1][1] = 6;

        proof.c[0] = 7;
        proof.c[1] = 8;
    }
}
