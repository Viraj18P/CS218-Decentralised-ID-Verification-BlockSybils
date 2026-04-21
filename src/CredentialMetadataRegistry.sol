// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DIDRegistry} from "./DIDRegistry.sol";

contract CredentialMetadataRegistry {
    struct CredentialRecord {
        string issuerDID;
        address issuer;
        uint256 revocationIndex;
        bool exists;
    }

    error ZeroAddress();
    error InvalidCredentialId();
    error CredentialAlreadyRegistered(bytes32 credentialId);
    error CredentialNotFound(bytes32 credentialId);
    error CallerNotDidOwner(address caller, address expectedOwner);

    DIDRegistry public immutable didRegistry;

    mapping(bytes32 => CredentialRecord) private _credentials;

    event CredentialRegistered(
        bytes32 indexed credentialId,
        string issuerDID,
        address indexed issuer,
        uint256 indexed revocationIndex
    );

    constructor(address didRegistry_) {
        if (didRegistry_ == address(0)) revert ZeroAddress();
        didRegistry = DIDRegistry(didRegistry_);
    }

    function registerCredential(bytes32 credentialId, string calldata issuerDID, uint256 revocationIndex) external {
        if (credentialId == bytes32(0)) revert InvalidCredentialId();

        CredentialRecord storage record = _credentials[credentialId];
        if (record.issuer != address(0)) revert CredentialAlreadyRegistered(credentialId);

        address didOwner = didRegistry.getOwner(issuerDID);
        if (didOwner != msg.sender) revert CallerNotDidOwner(msg.sender, didOwner);

        record.issuerDID = issuerDID;
        record.issuer = didOwner;
        record.revocationIndex = revocationIndex;
        
        emit CredentialRegistered(credentialId, issuerDID, didOwner, revocationIndex);
    }

    function getCredential(bytes32 credentialId)
        public
        view
        returns (string memory issuerDID, address issuer, uint256 revocationIndex)
    {
        CredentialRecord storage record = _credentials[credentialId];
        if (!record.exists) revert CredentialNotFound(credentialId);

        return (record.issuerDID, record.issuer, record.revocationIndex);
    }

    function getIssuerDID(bytes32 credentialId) external view returns (string memory) {
        (string memory issuerDID,,) = getCredential(credentialId);
        return issuerDID;
    }

    function getIssuer(bytes32 credentialId) external view returns (address) {
        (, address issuer,) = getCredential(credentialId);
        return issuer;
    }

    function getRevocationIndex(bytes32 credentialId) external view returns (uint256) {
        (, , uint256 revocationIndex) = getCredential(credentialId);
        return revocationIndex;
    }

    function exists(bytes32 credentialId) external view returns (bool) {
        return _credentials[credentialId].exists;
    }
}
