// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

contract MockGroth16Verifier is IGroth16Verifier {
    bool private _shouldVerify = true;

    function setShouldVerify(bool shouldVerify) external {
        _shouldVerify = shouldVerify;
    }

    function verifyProof(
        uint256[2] memory,
        uint256[2][2] memory,
        uint256[2] memory,
        uint256[] memory
    ) external view returns (bool) {
        return _shouldVerify;
    }
}

