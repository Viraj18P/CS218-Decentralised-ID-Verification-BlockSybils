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

        console.log("\n DEPLOYMENT COMPLETE\n");
        console.log("IdentityRegistry:       ", address(registry));
        console.log("KYCGatedAuction:        ", address(auction));
        console.log("AgeVerifier:            ", address(ageV));
        console.log("CredentialValidVerifier:", address(credV));
        console.log("NullifierMerkleVerifier:", address(nullV));
        console.log("CompositeProofVerifier: ", address(compV));
        console.log("ZKGateway:              ", address(zkGateway));
        console.log("\n IdentityRegistry now supports:\n");
        console.log("  - registerIdentity(verifier, documentHash, ipfsCid, filename)");
        console.log("  - updateIPFSCid(newCid)");
        console.log("  - getIPFSCid(user)");
        console.log("  - getPendingForVerifier(verifier)");
        console.log("\n Hybrid Encryption Flow:\n");
        console.log("  1. Frontend: Generate random AES key");
        console.log("  2. Frontend: Encrypt document with AES-256-GCM");
        console.log("  3. Frontend: Encrypt AES key with verifier's public key (RSA-OAEP)");
        console.log("  4. Frontend: Upload encrypted package to IPFS (Pinata)");
        console.log("  5. Frontend: Compute keccak256 hash of original document");
        console.log("  6. Frontend: Call registerIdentity with CID + hash");
        console.log("  7. On-chain: Only store document hash + CID, never document/key");
        console.log("  8. Verifier: Download from IPFS, decrypt with private key");
        console.log("  9. Verifier: Verify hash matches on-chain");
        console.log(" 10. Verifier: Call verifyIdentity if document is valid");
        console.log("\n");
    }
}