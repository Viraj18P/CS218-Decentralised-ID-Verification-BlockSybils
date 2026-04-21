// SPDX-License-Identifier: GPL-3.0
// PLACEHOLDER — overwritten by `snarkjs zkey export solidityverifier` when zk_setup.sh runs.
// Until then, verifyProof() always returns false.
pragma solidity ^0.8.24;

import {IGroth16Verifier} from "../../interfaces/IGroth16Verifier.sol";

// Groth16 verifier for circuits/NullifierMerkle.circom
// Public signals: [0] merkle_root  [1] nullifier_hash  [2] external_nullifier
contract NullifierMerkleVerifier is IGroth16Verifier {
    uint256 private constant SIGNAL_COUNT = 3;

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
