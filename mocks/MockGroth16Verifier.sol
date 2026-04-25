// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGroth16Verifier}   from "../interfaces/IGroth16Verifier.sol";
import {IGroth16Verifier4}  from "../interfaces/IGroth16Verifier.sol";
import {IGroth16Verifier10} from "../interfaces/IGroth16Verifier.sol";

/// @dev Single mock that satisfies all three verifier interfaces.
/// The interface now uses calldata + fixed-size arrays, so the mock must match exactly.
contract MockGroth16Verifier is IGroth16Verifier, IGroth16Verifier4, IGroth16Verifier10 {
    bool private _shouldVerify = true;

    function setShouldVerify(bool shouldVerify) external {
        _shouldVerify = shouldVerify;
    }

    // IGroth16Verifier — 3 signals (AgeVerifier / NullifierMerkle)
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[3] calldata
    ) external view override(IGroth16Verifier) returns (bool) {
        return _shouldVerify;
    }

    // IGroth16Verifier4 — 4 signals (CredentialValid)
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[4] calldata
    ) external view override(IGroth16Verifier4) returns (bool) {
        return _shouldVerify;
    }

    // IGroth16Verifier10 — 10 signals (CompositeProof)
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[10] calldata
    ) external view override(IGroth16Verifier10) returns (bool) {
        return _shouldVerify;
    }
}
