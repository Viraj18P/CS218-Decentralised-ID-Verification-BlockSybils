// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ZKGateway} from "../contracts/zk/ZKGateway.sol";

/**
 * @title RedeployZKGateway
 * @notice Redeploys ONLY ZKGateway with the fixed interface.
 *         The four snarkjs verifiers are ALREADY deployed and correct — no need to redeploy them.
 *
 * Root cause of the original CALL_EXCEPTION:
 *   IGroth16Verifier used uint256[] (dynamic) but snarkjs generates uint256[N] (fixed).
 *   Different selectors → every call to the sub-verifier hit a nonexistent function.
 *
 * Fix: ZKGateway now uses IVerifier3/IVerifier4/IVerifier10 with fixed-size arrays,
 *      and copies the dynamic publicSignals slice into a stack array before calling.
 *
 * Usage:
 *   forge script scripts/RedeployZKGateway.s.sol \
 *       --rpc-url $SEPOLIA_RPC_URL   \
 *       --private-key $PRIVATE_KEY   \
 *       --broadcast                  \
 *       --verify                     \
 *       --etherscan-api-key $ETHERSCAN_KEY
 *
 * After deployment: copy the new ZK_GATEWAY address into frontend/src/contracts.js
 */
contract RedeployZKGateway is Script {

    // ── Already-deployed verifier addresses on Sepolia ───────────────────────
    // These are the real snarkjs-generated verifiers from the previous deployment.
    // DO NOT redeploy these — they are correct.
    address constant AGE_VERIFIER             = 0x5e4368Bba85d421c6E41BDC2aDaE5442D13D2566;
    address constant CREDENTIAL_VALID_VERIFIER = 0xFf3Fd7A6B4de12d42866f20471fC1DB6BBA8E056;
    address constant NULLIFIER_MERKLE_VERIFIER = 0xb3236d6373Bc2c73035781b50Fe5e417e3A3ce01;
    address constant COMPOSITE_PROOF_VERIFIER  = 0xf1416F34E4129272Ea542Be313297aC23E4CCCB0;

    function run() external {
        vm.startBroadcast();

        address deployer = msg.sender;
        console.log("Redeploying ZKGateway from:", deployer);
        console.log("Reusing existing verifiers:");
        console.log("  AgeVerifier:            ", AGE_VERIFIER);
        console.log("  CredentialValidVerifier:", CREDENTIAL_VALID_VERIFIER);
        console.log("  NullifierMerkleVerifier:", NULLIFIER_MERKLE_VERIFIER);
        console.log("  CompositeProofVerifier: ", COMPOSITE_PROOF_VERIFIER);

        ZKGateway gateway = new ZKGateway(
            AGE_VERIFIER,
            CREDENTIAL_VALID_VERIFIER,
            NULLIFIER_MERKLE_VERIFIER,
            COMPOSITE_PROOF_VERIFIER,
            deployer   // merkleAdmin
        );

        console.log("\nNew ZKGateway deployed at:", address(gateway));
        console.log("\n--- Update frontend/src/contracts.js ---");
        console.log(string.concat("  ZK_GATEWAY: '", vm.toString(address(gateway)), "',"));

        vm.stopBroadcast();
    }
}
