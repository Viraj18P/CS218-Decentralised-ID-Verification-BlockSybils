// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZKGateway} from "../../contracts/zk/ZKGateway.sol";
import {IZKVerification} from "../../contracts/zk/IZKVerification.sol";
import {MockGroth16Verifier} from "../../mocks/MockGroth16Verifier.sol";

contract ZKGatewayTest is Test {
    ZKGateway private gateway;

    MockGroth16Verifier private ageVerifier;
    MockGroth16Verifier private credVerifier;
    MockGroth16Verifier private nullifierVerifier;
    MockGroth16Verifier private compositeVerifier;

    address private constant ADMIN = address(0xAD);
    address private constant USER  = address(0xBEEF);

    bytes32 private constant MERKLE_ROOT    = bytes32(uint256(0x1234));
    bytes32 private constant NULLIFIER      = bytes32(uint256(0x5678));
    bytes32 private constant EXT_NULLIFIER  = bytes32(uint256(0x9abc));
    bytes32 private constant CREDENTIAL_ID  = keccak256("test-credential");

    function setUp() public {
        ageVerifier       = new MockGroth16Verifier();
        credVerifier      = new MockGroth16Verifier();
        nullifierVerifier = new MockGroth16Verifier();
        compositeVerifier = new MockGroth16Verifier();

        gateway = new ZKGateway(
            address(ageVerifier),
            address(credVerifier),
            address(nullifierVerifier),
            address(compositeVerifier),
            ADMIN
        );

        vm.prank(ADMIN);
        gateway.addMerkleRoot(MERKLE_ROOT);
    }

    // =========================================================================
    // Age proof
    // =========================================================================

    function testVerifyAgeProofReturnsTrueOnValidProof() public {
        uint256[] memory signals = _ageSignals(20000, 6570);
        assertTrue(gateway.verifyAgeProof(_proof(), signals));
    }

    function testVerifyAgeProofReturnsFalseWhenVerifierRejects() public {
        ageVerifier.setShouldVerify(false);
        assertFalse(gateway.verifyAgeProof(_proof(), _ageSignals(20000, 6570)));
    }

    function testVerifyAgeProofRevertsOnWrongSignalCount() public {
        uint256[] memory signals = new uint256[](2);
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.WrongSignalCount.selector, 2, 3));
        gateway.verifyAgeProof(_proof(), signals);
    }

    // =========================================================================
    // Credential proof
    // =========================================================================

    function testVerifyCredentialProofSuccess() public {
        uint256[] memory signals = _credSignals(CREDENTIAL_ID);
        assertTrue(gateway.verifyCredentialProof(CREDENTIAL_ID, _proof(), signals));
    }

    function testVerifyCredentialProofReturnsFalseWhenVerifierRejects() public {
        credVerifier.setShouldVerify(false);
        assertFalse(gateway.verifyCredentialProof(CREDENTIAL_ID, _proof(), _credSignals(CREDENTIAL_ID)));
    }

    function testVerifyCredentialProofRevertsOnWrongSignalCount() public {
        uint256[] memory signals = new uint256[](3);
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.WrongSignalCount.selector, 3, 4));
        gateway.verifyCredentialProof(CREDENTIAL_ID, _proof(), signals);
    }

    function testVerifyCredentialProofRevertsOnCredentialIdMismatch() public {
        bytes32 differentId = keccak256("different-credential");
        uint256[] memory signals = _credSignals(CREDENTIAL_ID);
        // signals[1] encodes CREDENTIAL_ID but we pass differentId as the expected one
        vm.expectRevert(
            abi.encodeWithSelector(ZKGateway.CredentialIdMismatch.selector, differentId, CREDENTIAL_ID)
        );
        gateway.verifyCredentialProof(differentId, _proof(), signals);
    }

    // =========================================================================
    // Nullifier + Merkle
    // =========================================================================

    function testVerifyAndConsumeNullifierSuccess() public {
        uint256[] memory signals = _nullifierSignals(MERKLE_ROOT, NULLIFIER, EXT_NULLIFIER);
        assertTrue(gateway.verifyAndConsumeNullifier(_proof(), signals));
        assertTrue(gateway.isNullifierUsed(NULLIFIER));
    }

    function testNullifierReuseReverts() public {
        uint256[] memory signals = _nullifierSignals(MERKLE_ROOT, NULLIFIER, EXT_NULLIFIER);
        gateway.verifyAndConsumeNullifier(_proof(), signals);

        vm.expectRevert(abi.encodeWithSelector(ZKGateway.NullifierAlreadyUsed.selector, NULLIFIER));
        gateway.verifyAndConsumeNullifier(_proof(), signals);
    }

    function testNullifierNotConsumedWhenProofFails() public {
        nullifierVerifier.setShouldVerify(false);
        uint256[] memory signals = _nullifierSignals(MERKLE_ROOT, NULLIFIER, EXT_NULLIFIER);
        assertFalse(gateway.verifyAndConsumeNullifier(_proof(), signals));
        assertFalse(gateway.isNullifierUsed(NULLIFIER));
    }

    function testInvalidMerkleRootReverts() public {
        bytes32 unknownRoot = bytes32(uint256(0xdead));
        uint256[] memory signals = _nullifierSignals(unknownRoot, NULLIFIER, EXT_NULLIFIER);
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.InvalidMerkleRoot.selector, unknownRoot));
        gateway.verifyAndConsumeNullifier(_proof(), signals);
    }

    function testNullifierSignalCountRevertsOnWrongCount() public {
        uint256[] memory signals = new uint256[](2);
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.WrongSignalCount.selector, 2, 3));
        gateway.verifyAndConsumeNullifier(_proof(), signals);
    }

    // =========================================================================
    // Composite proof
    // =========================================================================

    function testCompositeProofSuccessConsumesNullifier() public {
        uint256[] memory signals = _compositeSignals(CREDENTIAL_ID, MERKLE_ROOT, NULLIFIER, EXT_NULLIFIER);
        assertTrue(gateway.verifyCompositeProof(CREDENTIAL_ID, _proof(), signals));
        assertTrue(gateway.isNullifierUsed(NULLIFIER));
    }

    function testCompositeProofNullifierReuseReverts() public {
        uint256[] memory signals = _compositeSignals(CREDENTIAL_ID, MERKLE_ROOT, NULLIFIER, EXT_NULLIFIER);
        gateway.verifyCompositeProof(CREDENTIAL_ID, _proof(), signals);

        vm.expectRevert(abi.encodeWithSelector(ZKGateway.NullifierAlreadyUsed.selector, NULLIFIER));
        gateway.verifyCompositeProof(CREDENTIAL_ID, _proof(), signals);
    }

    function testCompositeProofMerkleRootMismatchReverts() public {
        bytes32 badRoot = bytes32(uint256(0xbadf00d));
        uint256[] memory signals = _compositeSignals(CREDENTIAL_ID, badRoot, NULLIFIER, EXT_NULLIFIER);
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.InvalidMerkleRoot.selector, badRoot));
        gateway.verifyCompositeProof(CREDENTIAL_ID, _proof(), signals);
    }

    function testCompositeProofCredentialMismatchReverts() public {
        bytes32 wrongId = keccak256("wrong");
        uint256[] memory signals = _compositeSignals(CREDENTIAL_ID, MERKLE_ROOT, NULLIFIER, EXT_NULLIFIER);
        vm.expectRevert(
            abi.encodeWithSelector(ZKGateway.CredentialIdMismatch.selector, wrongId, CREDENTIAL_ID)
        );
        gateway.verifyCompositeProof(wrongId, _proof(), signals);
    }

    function testCompositeProofSignalCountReverts() public {
        uint256[] memory signals = new uint256[](9);
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.WrongSignalCount.selector, 9, 10));
        gateway.verifyCompositeProof(CREDENTIAL_ID, _proof(), signals);
    }

    function testCompositeProofReturnsFalseWhenVerifierRejects() public {
        compositeVerifier.setShouldVerify(false);
        uint256[] memory signals = _compositeSignals(CREDENTIAL_ID, MERKLE_ROOT, NULLIFIER, EXT_NULLIFIER);
        assertFalse(gateway.verifyCompositeProof(CREDENTIAL_ID, _proof(), signals));
        // Nullifier must NOT be consumed when proof fails
        assertFalse(gateway.isNullifierUsed(NULLIFIER));
    }

    // =========================================================================
    // Merkle root admin
    // =========================================================================

    function testOnlyAdminCanAddMerkleRoot() public {
        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.Unauthorized.selector));
        gateway.addMerkleRoot(bytes32(uint256(0x9999)));
    }

    function testAdminCanAddMultipleMerkleRoots() public {
        bytes32 root2 = bytes32(uint256(0xabcd));
        vm.prank(ADMIN);
        gateway.addMerkleRoot(root2);
        assertTrue(gateway.isMerkleRootValid(root2));
        assertTrue(gateway.isMerkleRootValid(MERKLE_ROOT));
    }

    function testIsNullifierUsedReturnsFalseInitially() public {
        assertFalse(gateway.isNullifierUsed(bytes32(uint256(0xffff))));
    }

    // =========================================================================
    // Constructor guard
    // =========================================================================

    function testConstructorRevertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(ZKGateway.ZeroAddress.selector));
        new ZKGateway(
            address(0),
            address(credVerifier),
            address(nullifierVerifier),
            address(compositeVerifier),
            ADMIN
        );
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _proof() private pure returns (IZKVerification.Groth16Proof memory p) {
        p.a    = [uint256(1), uint256(2)];
        p.b    = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        p.c    = [uint256(7), uint256(8)];
    }

    function _ageSignals(uint256 currentDays, uint256 minAgeDays)
        private pure returns (uint256[] memory s)
    {
        s = new uint256[](3);
        s[0] = currentDays;
        s[1] = minAgeDays;
        s[2] = uint256(keccak256("age-commitment"));
    }

    function _credSignals(bytes32 credId) private pure returns (uint256[] memory s) {
        s = new uint256[](4);
        s[0] = uint256(keccak256("issuer-pubkey-hash"));
        s[1] = uint256(credId);
        s[2] = uint256(keccak256("schema-hash"));
        s[3] = uint256(keccak256("binding-commitment"));
    }

    function _nullifierSignals(bytes32 root, bytes32 nullifier, bytes32 extNullifier)
        private pure returns (uint256[] memory s)
    {
        s = new uint256[](3);
        s[0] = uint256(root);
        s[1] = uint256(nullifier);
        s[2] = uint256(extNullifier);
    }

    function _compositeSignals(
        bytes32 credId,
        bytes32 root,
        bytes32 nullifier,
        bytes32 extNullifier
    ) private pure returns (uint256[] memory s) {
        s = new uint256[](10);
        s[0] = 20000;                                        // current_days
        s[1] = 6570;                                         // min_age_days
        s[2] = uint256(keccak256("age-commitment"));         // age_commitment
        s[3] = uint256(keccak256("issuer-pubkey-hash"));     // issuer_pubkey_hash
        s[4] = uint256(credId);                              // credential_id_hash
        s[5] = uint256(keccak256("schema-hash"));            // schema_hash
        s[6] = uint256(keccak256("binding-commitment"));     // binding_commitment
        s[7] = uint256(root);                                // merkle_root
        s[8] = uint256(nullifier);                           // nullifier_hash
        s[9] = uint256(extNullifier);                        // external_nullifier
    }
}
