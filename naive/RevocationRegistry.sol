// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RevocationRegistry {
    error AlreadyRevoked(address issuer, uint256 index);
    error NotRevoked(address issuer, uint256 index);

    // Each issuer maintains its own bitmap namespace.
    mapping(address issuer => mapping(uint256 bucket => uint256 bitmapWord)) private _revocationBitmaps;
    mapping(address issuer => uint256[] revokedIndexes) private _revokedIndexesByIssuer;

    event Revoked(address indexed issuer, uint256 indexed index, uint256 indexed bucket, uint256 mask);
    event Unrevoked(address indexed issuer, uint256 indexed index, uint256 indexed bucket, uint256 mask);

    function revoke(uint256 index) external {
        (uint256 bucket, uint256 mask) = _position(index);
        uint256[] storage revokedIndexes = _revokedIndexesByIssuer[msg.sender];

        for (uint256 i = 0; i < revokedIndexes.length; i++) {
            if (revokedIndexes[i] == index) revert AlreadyRevoked(msg.sender, index);
        }

        revokedIndexes.push(index);
        _revocationBitmaps[msg.sender][bucket] = _revocationBitmaps[msg.sender][bucket] | mask;
        emit Revoked(msg.sender, index, bucket, mask);
    }

    function unrevoke(uint256 index) external {
        (uint256 bucket, uint256 mask) = _position(index);
        uint256[] storage revokedIndexes = _revokedIndexesByIssuer[msg.sender];
        uint256 length = revokedIndexes.length;
        uint256 matchIndex = type(uint256).max;

        for (uint256 i = 0; i < length; i++) {
            if (revokedIndexes[i] == index) {
                matchIndex = i;
                break;
            }
        }

        if (matchIndex == type(uint256).max) revert NotRevoked(msg.sender, index);

        revokedIndexes[matchIndex] = revokedIndexes[length - 1];
        revokedIndexes.pop();
        _revocationBitmaps[msg.sender][bucket] = _revocationBitmaps[msg.sender][bucket] & ~mask;
        emit Unrevoked(msg.sender, index, bucket, mask);
    }

    function isRevoked(address issuer, uint256 index) external view returns (bool) {
        uint256[] storage revokedIndexes = _revokedIndexesByIssuer[issuer];

        for (uint256 i = 0; i < revokedIndexes.length; i++) {
            if (revokedIndexes[i] == index) {
                return true;
            }
        }

        return false;
    }

    function getBucket(address issuer, uint256 bucket) external view returns (uint256) {
        return _revocationBitmaps[issuer][bucket];
    }

    function _position(uint256 index) private pure returns (uint256 bucket, uint256 mask) {
        // Each uint256 bucket tracks 256 revocation flags.
        bucket = index >> 8;
        mask = uint256(1) << (index & 0xff);
    }
}
