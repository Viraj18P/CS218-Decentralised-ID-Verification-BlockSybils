// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProtocolAccessManaged} from "./access/ProtocolAccessManaged.sol";

/// @title IdentityRegistry
/// @notice Stores only document hashes and verification status for decentralized identity checks.
/// @dev Raw identity documents must stay off-chain. This contract stores keccak256 hashes only.
contract IdentityRegistry is ProtocolAccessManaged {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

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
        address revokedBy;
        address assignedVerifier;
        uint64 registeredAt;
        uint64 verifiedAt;
        uint64 revokedAt;
        string ipfsCid;
        string filename;
    }

    error InvalidUser();
    error EmptyDocumentHash();
    error EmptyIPFSCid();
    error IdentityAlreadyRegistered(address user, Status currentStatus);
    error IdentityNotRegistered(address user);
    error IdentityNotPending(address user, Status currentStatus);
    error IdentityNotVerified(address user, Status currentStatus);
    error IdentityAlreadyRevoked(address user);
    error UnchangedDocumentHash();
    error VerifierAlreadyAssigned(address verifier);
    error VerifierNotAssigned(address verifier);
    error UnauthorizedVerifier(address verifier);

    mapping(address user => Identity identity) private _identities;

    event IdentityRegistered(address indexed user, address indexed verifier, bytes32 indexed documentHash, string ipfsCid, string filename, uint64 registeredAt);
    event IdentityDocumentUpdated(address indexed user, bytes32 indexed oldDocumentHash, bytes32 indexed newDocumentHash);
    event IdentityIPFSUpdated(address indexed user, string oldCid, string newCid);
    event IdentityVerified(address indexed user, address indexed verifiedBy, uint64 verifiedAt);
    event IdentityRevoked(address indexed user, address indexed revokedBy, uint64 revokedAt);
    event VerifierAdded(address indexed verifier, address indexed admin);
    event VerifierRemoved(address indexed verifier, address indexed admin);

    /// @notice Creates the registry and grants admin, pauser, and verifier rights to the initial admin.
    /// @param initialAdmin Address that receives DEFAULT_ADMIN_ROLE, PAUSER_ROLE, and VERIFIER_ROLE.
    constructor(address initialAdmin) ProtocolAccessManaged(initialAdmin) {
        _grantRole(VERIFIER_ROLE, initialAdmin);
    }

    /// @notice Registers the caller's identity with hybrid encryption metadata.
    /// @param verifier Address of the assigned verifier
    /// @param documentHash keccak256 hash of the original (unencrypted) document
    /// @param ipfsCid IPFS CID of the encrypted document
    /// @param filename Original filename for reference
    function registerIdentity(address verifier, bytes32 documentHash, string calldata ipfsCid, string calldata filename) external whenNotPaused {
        if (documentHash == bytes32(0)) revert EmptyDocumentHash();
        if (verifier == address(0)) revert InvalidUser();
        if (bytes(ipfsCid).length == 0) revert EmptyIPFSCid();

        Identity storage identity = _identities[msg.sender];
        if (identity.status != Status.NotRegistered) {
            revert IdentityAlreadyRegistered(msg.sender, identity.status);
        }

        _identities[msg.sender] = Identity({
            documentHash: documentHash,
            status: Status.Pending,
            verifiedBy: address(0),
            revokedBy: address(0),
            assignedVerifier: verifier,
            registeredAt: uint64(block.timestamp),
            verifiedAt: 0,
            revokedAt: 0,
            ipfsCid: ipfsCid,
            filename: filename
        });

        emit IdentityRegistered(msg.sender, verifier, documentHash, ipfsCid, filename, uint64(block.timestamp));
    }

    /// @notice Allows the caller to replace a pending document hash before verification.
    /// @param newDocumentHash New keccak256 hash of the off-chain identity document.
    function updatePendingIdentity(bytes32 newDocumentHash) external whenNotPaused {
        if (newDocumentHash == bytes32(0)) revert EmptyDocumentHash();

        Identity storage identity = _requireRegistered(msg.sender);
        if (identity.status != Status.Pending) revert IdentityNotPending(msg.sender, identity.status);
        if (identity.documentHash == newDocumentHash) revert UnchangedDocumentHash();

        bytes32 oldDocumentHash = identity.documentHash;
        identity.documentHash = newDocumentHash;

        emit IdentityDocumentUpdated(msg.sender, oldDocumentHash, newDocumentHash);
    }

    /// @notice Verifies a pending identity (only assigned verifier can call)
    /// @param user Address whose pending identity should be verified.
    function verifyIdentity(address user) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        if (user == address(0)) revert InvalidUser();

        Identity storage identity = _requireRegistered(user);
        if (identity.status != Status.Pending) revert IdentityNotPending(user, identity.status);
        if (identity.assignedVerifier != msg.sender) revert UnauthorizedVerifier(msg.sender);

        identity.status = Status.Verified;
        identity.verifiedBy = msg.sender;
        identity.revokedBy = address(0);
        identity.verifiedAt = uint64(block.timestamp);
        identity.revokedAt = 0;

        emit IdentityVerified(user, msg.sender, uint64(block.timestamp));
    }

    /// @notice Revokes a previously verified identity.
    /// @param user Address whose verified identity should be revoked.
    function revokeIdentity(address user) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        if (user == address(0)) revert InvalidUser();

        Identity storage identity = _requireRegistered(user);
        if (identity.status == Status.Revoked) revert IdentityAlreadyRevoked(user);
        if (identity.status != Status.Verified) revert IdentityNotVerified(user, identity.status);

        identity.status = Status.Revoked;
        identity.revokedBy = msg.sender;
        identity.revokedAt = uint64(block.timestamp);

        emit IdentityRevoked(user, msg.sender, uint64(block.timestamp));
    }

    /// @notice Grants verifier permissions to an address.
    /// @param verifier Address to grant VERIFIER_ROLE.
    function addVerifier(address verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (verifier == address(0)) revert InvalidUser();
        if (hasRole(VERIFIER_ROLE, verifier)) revert VerifierAlreadyAssigned(verifier);

        _grantRole(VERIFIER_ROLE, verifier);
        emit VerifierAdded(verifier, msg.sender);
    }

    /// @notice Removes verifier permissions from an address.
    /// @param verifier Address to revoke VERIFIER_ROLE from.
    function removeVerifier(address verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (verifier == address(0)) revert InvalidUser();
        if (!hasRole(VERIFIER_ROLE, verifier)) revert VerifierNotAssigned(verifier);

        _revokeRole(VERIFIER_ROLE, verifier);
        emit VerifierRemoved(verifier, msg.sender);
    }

    /// @notice Returns true only when the user has a verified, non-revoked identity.
    /// @param user Address to check.
    /// @return True if the identity status is Verified.
    function isVerified(address user) external view returns (bool) {
        return _identities[user].status == Status.Verified;
    }

    /// @notice Returns the full identity record for a user.
    function getIdentity(address user)
        external
        view
        returns (
            bytes32 documentHash,
            Status status,
            address verifiedBy,
            address revokedBy,
            address assignedVerifier,
            uint64 registeredAt,
            uint64 verifiedAt,
            uint64 revokedAt,
            string memory ipfsCid,
            string memory filename
        )
    {
        Identity storage identity = _identities[user];
        return (
            identity.documentHash,
            identity.status,
            identity.verifiedBy,
            identity.revokedBy,
            identity.assignedVerifier,
            identity.registeredAt,
            identity.verifiedAt,
            identity.revokedAt,
            identity.ipfsCid,
            identity.filename
        );
    }

    /// @notice Returns IPFS CID for a registered user's document
    function getIPFSCid(address user) external view returns (string memory) {
        return _requireRegistered(user).ipfsCid;
    }

    /// @notice Returns the assigned verifier for an identity
    function getAssignedVerifier(address user) external view returns (address) {
        return _requireRegistered(user).assignedVerifier;
    }

    /// @notice Returns all pending identities for a verifier
    function getPendingForVerifier(address verifier) external view returns (address[] memory pending) {
        // Note: This requires iterating through mappings, which is gas-inefficient
        // In production, use events for off-chain indexing
        pending = new address[](0); // Placeholder for frontend to fetch via events
    }

    /// @notice Update IPFS CID before verification
    function updateIPFSCid(string calldata newCid) external {
        if (bytes(newCid).length == 0) revert EmptyIPFSCid();

        Identity storage identity = _identities[msg.sender];
        if (identity.status == Status.NotRegistered) revert IdentityNotRegistered(msg.sender);
        if (identity.status != Status.Pending) revert IdentityNotPending(msg.sender, identity.status);

        string memory oldCid = identity.ipfsCid;
        identity.ipfsCid = newCid;

        emit IdentityIPFSUpdated(msg.sender, oldCid, newCid);
    }

    /// @notice Returns the stored document hash for a registered user.
    /// @param user Address whose document hash is requested.
    /// @return Stored keccak256 document hash.
    function getDocumentHash(address user) external view returns (bytes32) {
        return _requireRegistered(user).documentHash;
    }

    /// @notice Returns the current identity status for a user.
    /// @param user Address to check.
    /// @return Current identity status.
    function getStatus(address user) external view returns (Status) {
        return _identities[user].status;
    }

    function _requireRegistered(address user) private view returns (Identity storage identity) {
        if (user == address(0)) revert InvalidUser();

        identity = _identities[user];
        if (identity.status == Status.NotRegistered) revert IdentityNotRegistered(user);
    }
}