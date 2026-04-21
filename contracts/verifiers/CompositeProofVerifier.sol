// SPDX-License-Identifier: GPL-3.0
// PLACEHOLDER — overwritten by `snarkjs zkey export solidityverifier` when zk_setup.sh runs.
// Until then, verifyProof() always returns false.
pragma solidity ^0.8.24;

import {IGroth16Verifier} from "../../interfaces/IGroth16Verifier.sol";

// Groth16 verifier for circuits/CompositeProof.circom
// Public signals:
//   [0] current_days       [1] min_age_days      [2] age_commitment
//   [3] issuer_pubkey_hash [4] credential_id_hash [5] schema_hash
//   [6] binding_commitment [7] merkle_root        [8] nullifier_hash
//   [9] external_nullifier
contract CompositeProofVerifier is IGroth16Verifier {
    uint256 private constant SIGNAL_COUNT = 10;

    error WrongInputLength(uint256 got, uint256 expected);

    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) external view override returns (bool) {
        if (input.length != SIGNAL_COUNT) revert WrongInputLength(input.length, SIGNAL_COUNT);
        (a, b, c);
        return false;
    }
}
