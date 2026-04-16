// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DIDRegistry {
    // The registry accepts full string DIDs at the API layer, but stores them under a
    // deterministic hash so lookups stay cheap and do not rely on dynamic string keys.
    struct DidDocument {
        address owner;
        bytes publicKey;
        uint256 updatedTimestamp;
    }

    error DIDAlreadyRegistered(bytes32 didHash);
    error DIDNotFound(bytes32 didHash);
    error EmptyDID();
    error EmptyPublicKey();
    error Unauthorized();

    mapping(bytes32 => DidDocument) private _documents;

    event DIDRegistered(
        bytes32 indexed didHash, string did, address indexed owner, bytes publicKey, uint256 updatedTimestamp
    );
    event DIDPublicKeyUpdated(
        bytes32 indexed didHash, string did, bytes oldPublicKey, bytes newPublicKey, uint256 updatedTimestamp
    );

    function registerDid(string calldata did, bytes calldata pubKey) external {
        bytes32 didHash = _didHashOrRevert(did);
        if (pubKey.length == 0) revert EmptyPublicKey();

        DidDocument storage document = _documents[didHash];
        if (document.owner != address(0)) revert DIDAlreadyRegistered(didHash);

        document.owner = msg.sender;
        document.publicKey = pubKey;
        document.updatedTimestamp = block.timestamp;

        emit DIDRegistered(didHash, did, msg.sender, pubKey, block.timestamp);
    }

    function updatePublicKey(string calldata did, bytes calldata newKey) external {
        bytes32 didHash = _didHashOrRevert(did);
        if (newKey.length == 0) revert EmptyPublicKey();

        DidDocument storage document = _requireDocument(didHash);
        if (document.owner != msg.sender) revert Unauthorized();

        bytes memory oldKey = document.publicKey;
        document.publicKey = newKey;
        document.updatedTimestamp = block.timestamp;

        emit DIDPublicKeyUpdated(didHash, did, oldKey, newKey, block.timestamp);
    }

    function getPublicKey(string calldata did) external view returns (bytes memory) {
        return _requireDocument(_didHashOrRevert(did)).publicKey;
    }

    function getPublicKeyByHash(bytes32 didHash) external view returns (bytes memory) {
        return _requireDocument(didHash).publicKey;
    }

    function getOwner(string calldata did) external view returns (address) {
        return _requireDocument(_didHashOrRevert(did)).owner;
    }

    function getOwnerByHash(bytes32 didHash) external view returns (address) {
        return _requireDocument(didHash).owner;
    }

    function getDocument(string calldata did)
        external
        view
        returns (address owner, bytes memory publicKey, uint256 updatedTimestamp)
    {
        DidDocument storage document = _requireDocument(_didHashOrRevert(did));
        return (document.owner, document.publicKey, document.updatedTimestamp);
    }

    function getUpdatedTimestamp(string calldata did) external view returns (uint256) {
        return _requireDocument(_didHashOrRevert(did)).updatedTimestamp;
    }

    function isRegistered(string calldata did) external view returns (bool) {
        bytes32 didHash = _didHashOrRevert(did);
        return _documents[didHash].owner != address(0);
    }

    function computeDidHash(string calldata did) external pure returns (bytes32) {
        return _didHashOrRevert(did);
    }

    function _requireDocument(bytes32 didHash) private view returns (DidDocument storage document) {
        document = _documents[didHash];
        if (document.owner == address(0)) revert DIDNotFound(didHash);
    }

    function _didHashOrRevert(string calldata did) private pure returns (bytes32) {
        if (bytes(did).length == 0) revert EmptyDID();
        return keccak256(abi.encodePacked(did));
    }
}
