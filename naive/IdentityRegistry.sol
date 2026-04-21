// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title IdentityRegistry
/// @notice Stores only document hashes and verification status for decentralized identity checks.
/// @dev Raw identity documents must stay off-chain. This contract stores keccak256 hashes only.
contract IdentityRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    address[] private _registeredUsers;

    enum Status {
        NotRegistered,
        Pending,
        Verified,
        Revoked
    }

    struct Identity {
        bytes32 documentHash;
        Status status;
        address verifiedBy;
        uint64 registeredAt;
        uint64 verifiedAt;
        uint64 revokedAt;
    }

    mapping(address user => Identity identity) private _identities;

    event IdentityRegistered(address indexed user, bytes32 indexed documentHash, uint64 registeredAt);
    event IdentityVerified(address indexed user, address indexed verifiedBy, uint64 verifiedAt);
    event IdentityRevoked(address indexed user, address indexed revokedBy, uint64 revokedAt);
    event VerifierAdded(address indexed verifier, address indexed admin);
    event VerifierRemoved(address indexed verifier, address indexed admin);

    /// @notice Creates the registry and grants admin and verifier rights to the initial admin.
    /// @param initialAdmin Address that receives DEFAULT_ADMIN_ROLE and VERIFIER_ROLE.
    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "Initial admin cannot be zero");

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(VERIFIER_ROLE, initialAdmin);
    }

    /// @notice Registers the caller's identity hash and marks it as pending.
    /// @param documentHash keccak256 hash of the off-chain identity document.
    function registerIdentity(bytes32 documentHash) external {
        require(documentHash != bytes32(0), "Document hash cannot be empty");
        for (uint256 i = 0; i < _registeredUsers.length; i++) {
            require(_registeredUsers[i] != msg.sender, "Identity already registered");
        }

        _identities[msg.sender] = Identity({
            documentHash: documentHash,
            status: Status.Pending,
            verifiedBy: address(0),
            registeredAt: uint64(block.timestamp),
            verifiedAt: 0,
            revokedAt: 0
        });
        _registeredUsers.push(msg.sender);

        emit IdentityRegistered(msg.sender, documentHash, uint64(block.timestamp));
    }

    /// @notice Verifies a pending identity.
    /// @param user Address whose pending identity should be verified.
    function verifyIdentity(address user) external onlyRole(VERIFIER_ROLE) {
        require(user != address(0), "User cannot be zero");

        Identity storage identity = _identities[user];
        require(identity.status != Status.NotRegistered, "Identity not registered");
        require(identity.status == Status.Pending, "Identity is not pending");

        identity.status = Status.Verified;
        identity.verifiedBy = msg.sender;
        identity.verifiedAt = uint64(block.timestamp);
        identity.revokedAt = 0;

        emit IdentityVerified(user, msg.sender, uint64(block.timestamp));
    }

    /// @notice Revokes a registered identity.
    /// @param user Address whose identity should be revoked.
    function revokeIdentity(address user) external onlyRole(VERIFIER_ROLE) {
        require(user != address(0), "User cannot be zero");

        Identity storage identity = _identities[user];
        require(identity.status != Status.NotRegistered, "Identity not registered");
        require(identity.status != Status.Revoked, "Identity already revoked");

        identity.status = Status.Revoked;
        identity.revokedAt = uint64(block.timestamp);

        emit IdentityRevoked(user, msg.sender, uint64(block.timestamp));
    }

    /// @notice Grants verifier permissions to an address.
    /// @param verifier Address to grant VERIFIER_ROLE.
    function addVerifier(address verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(verifier != address(0), "Verifier cannot be zero");
        grantRole(VERIFIER_ROLE, verifier);
        emit VerifierAdded(verifier, msg.sender);
    }

    /// @notice Removes verifier permissions from an address.
    /// @param verifier Address to revoke VERIFIER_ROLE from.
    function removeVerifier(address verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(verifier != address(0), "Verifier cannot be zero");
        revokeRole(VERIFIER_ROLE, verifier);
        emit VerifierRemoved(verifier, msg.sender);
    }

    /// @notice Returns true only when the user has a verified, non-revoked identity.
    /// @param user Address to check.
    /// @return True if the identity status is Verified.
    function isVerified(address user) external view returns (bool) {
        return _identities[user].status == Status.Verified;
    }

    /// @notice Returns the full identity record for a user.
    /// @param user Address whose identity record is requested.
    /// @return documentHash Stored keccak256 document hash.
    /// @return status Current identity status.
    /// @return verifiedBy Verifier that approved the identity.
    /// @return registeredAt Registration timestamp.
    /// @return verifiedAt Verification timestamp.
    /// @return revokedAt Revocation timestamp.
    function getIdentity(address user)
        external
        view
        returns (
            bytes32 documentHash,
            Status status,
            address verifiedBy,
            uint64 registeredAt,
            uint64 verifiedAt,
            uint64 revokedAt
        )
    {
        Identity storage identity = _identities[user];
        return (
            identity.documentHash,
            identity.status,
            identity.verifiedBy,
            identity.registeredAt,
            identity.verifiedAt,
            identity.revokedAt
        );
    }

    /// @notice Returns the stored document hash for a registered user.
    /// @param user Address whose document hash is requested.
    /// @return Stored keccak256 document hash.
    function getDocumentHash(address user) external view returns (bytes32) {
        Identity storage identity = _identities[user];
        require(identity.status != Status.NotRegistered, "Identity not registered");
        return identity.documentHash;
    }

    /// @notice Returns the current identity status for a user.
    /// @param user Address to check.
    /// @return Current identity status.
    function getStatus(address user) external view returns (Status) {
        return _identities[user].status;
    }
}
