// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {KYCGatedAuction}  from "../src/KYCGatedAuction.sol";
import {Groth16Verifier} from "../contracts/verifiers/AgeVerifier.sol";
import {CredentialValidVerifier} from "../contracts/verifiers/CredentialValidVerifier.sol";
import {NullifierMerkleVerifier} from "../contracts/verifiers/NullifierMerkleVerifier.sol";
import {CompositeProofVerifier}  from "../contracts/verifiers/CompositeProofVerifier.sol";
import {ZKGateway}        from "../contracts/zk/ZKGateway.sol";

/**
 * @title Deploy
 * @notice Deploys the complete identity verification system with hybrid encryption support
 * 
 * Features:
 * - IdentityRegistry: Core contract for managing identities with IPFS CID storage
 * - KYCGatedAuction: Auction system gated by verified identities
 * - ZK Verifiers: Age, credential, nullifier, and composite proof verification
 * - ZKGateway: Central gateway for all ZK operations
 */
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        // ─────────────────────────────────────────────────────────────────
        // Core Identity Registry (with IPFS CID + verifier-specific encryption)
        // ─────────────────────────────────────────────────────────────────
        IdentityRegistry registry = new IdentityRegistry(deployer);
        
        // ─────────────────────────────────────────────────────────────────
        // KYC-Gated Auction
        // ─────────────────────────────────────────────────────────────────
        KYCGatedAuction auction   = new KYCGatedAuction(address(registry), deployer);

        // ─────────────────────────────────────────────────────────────────
        // ZK Verifiers (for age, credential, nullifier, composite proofs)
        // ─────────────────────────────────────────────────────────────────
        Groth16Verifier            ageV  = new Groth16Verifier();
        CredentialValidVerifier credV = new CredentialValidVerifier();
        NullifierMerkleVerifier nullV = new NullifierMerkleVerifier();
        CompositeProofVerifier  compV = new CompositeProofVerifier();

        // ─────────────────────────────────────────────────────────────────
        // ZKGateway: Central hub for ZK operations
        // ─────────────────────────────────────────────────────────────────
        ZKGateway zkGateway = new ZKGateway(
            address(ageV),
            address(credV),
            address(nullV),
            address(compV),
            deployer
        );

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log(string.concat("IdentityRegistry:        ", vm.toString(address(registry))));
        console.log(string.concat("KYCGatedAuction:         ", vm.toString(address(auction))));
        console.log(string.concat("AgeVerifier:             ", vm.toString(address(ageV))));
        console.log(string.concat("CredentialValidVerifier: ", vm.toString(address(credV))));
        console.log(string.concat("NullifierMerkleVerifier: ", vm.toString(address(nullV))));
        console.log(string.concat("CompositeProofVerifier:  ", vm.toString(address(compV))));
        console.log(string.concat("ZKGateway:               ", vm.toString(address(zkGateway))));
        console.log("");

        console.log("\n=== IdentityRegistry API ===\n");
        console.log("  registerIdentity(verifier, documentHash, ipfsCid, filename)");
        console.log("  verifyIdentity(user)   -- VERIFIER_ROLE only; status -> Verified");
        console.log("  revokeIdentity(user)   -- VERIFIER_ROLE only; status -> Revoked");
        console.log("  addVerifier(addr)      -- ADMIN only; reverts if addr identity is Revoked");
        console.log("  removeVerifier(addr)   -- ADMIN only");
        console.log("  isVerified(user)       -- public view; used by KYCGatedAuction.placeBid");
        console.log("  updateIPFSCid(newCid)  -- user can update CID while Pending");
        console.log("  getPendingForVerifier  -- returns empty array; index via events off-chain");

        console.log("\n=== Encryption Flow (nacl x25519-xsalsa20-poly1305 + AES-256-GCM) ===\n");
        console.log("  1. Registrant: fetch verifier MetaMask encryption public key");
        console.log("  2. Registrant: AES-256-GCM encrypt document locally in browser");
        console.log("  3. Registrant: wrap AES key in nacl box with verifier x25519 pubkey");
        console.log("  4. Registrant: upload AES-ciphertext to IPFS; CID + encKey in filename field");
        console.log("  5. Registrant: compute SHA-256 of original plaintext document");
        console.log("  6. Registrant: call registerIdentity(verifier, sha256hash, ipfsCid, filename)");
        console.log("  7. On-chain  : stores ONLY hash + CID; status = Pending");
        console.log("  8. Verifier  : fetches encrypted blob from IPFS");
        console.log("  9. Verifier  : MetaMask eth_decrypt decrypts nacl box -> AES key");
        console.log(" 10. Verifier  : AES-decrypts blob -> original document bytes");
        console.log(" 11. Verifier  : SHA-256(plaintext) compared to on-chain hash -> MUST match");
        console.log(" 12. Verifier  : if hash matches, call verifyIdentity(user)");

        console.log("\n=== Edge Cases Enforced ===\n");
        console.log("  - Unregistered user: isVerified() returns false");
        console.log("  - Revoking unregistered: reverts IdentityNotRegistered");
        console.log("  - Non-verifier approve: reverts AccessControlUnauthorizedAccount");
        console.log("  - Unverified bid in KYCGatedAuction: reverts 'KYC required'");
        console.log("  - Admin grants verifier to Revoked identity: reverts VerifierIdentityRevoked");

        console.log("\n=== Next Steps After Deploy ===");
        console.log("  1. Copy addresses above into frontend/src/contracts.js");
        console.log("  2. Add verifier org names in frontend/src/verifierNames.js");
        console.log("\n");
    }
}