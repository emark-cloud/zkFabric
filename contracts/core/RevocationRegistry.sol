// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RevocationRegistry — Issuer-controlled credential revocation
/// @notice Issuers (adapter contracts or admin) can revoke/restore credential hashes.
///         dApps can check revocation status before accepting proofs.
contract RevocationRegistry is Ownable {
    /// @notice credential hash => revoked
    mapping(uint256 => bool) public revoked;

    /// @notice Merkle root => revoked. A root is marked revoked when an issuer revokes
    ///         a credential that was committed to that tree state. Verifiers reject any
    ///         proof against a revoked root, forcing the user to re-prove against a fresh
    ///         root that excludes the revoked leaf.
    mapping(uint256 => bool) public revokedRoots;

    /// @notice nullifier => revoked. Banned nullifiers cannot pass verification even on
    ///         a non-revoked root. Used by issuers to ban already-seen nullifiers in a
    ///         specific scope after observing a revoked credential being used.
    mapping(uint256 => bool) public revokedNullifiers;

    /// @notice Addresses authorized to revoke credentials
    mapping(address => bool) public authorizedIssuers;

    event CredentialRevoked(uint256 indexed credentialHash, address indexed issuer);
    event CredentialRestored(uint256 indexed credentialHash, address indexed issuer);
    event RootRevoked(uint256 indexed root, address indexed issuer);
    event RootRestored(uint256 indexed root, address indexed issuer);
    event NullifierRevoked(uint256 indexed nullifier, address indexed issuer);
    event NullifierRestored(uint256 indexed nullifier, address indexed issuer);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    modifier onlyIssuer() {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner(),
            "RevocationRegistry: not authorized"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    function authorizeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @dev Open for demo — any caller can revoke. In production, restrict to onlyIssuer.
    function revoke(uint256 credentialHash) external {
        require(!revoked[credentialHash], "RevocationRegistry: already revoked");
        revoked[credentialHash] = true;
        emit CredentialRevoked(credentialHash, msg.sender);
    }

    function restore(uint256 credentialHash) external {
        require(revoked[credentialHash], "RevocationRegistry: not revoked");
        revoked[credentialHash] = false;
        emit CredentialRestored(credentialHash, msg.sender);
    }

    function isRevoked(uint256 credentialHash) external view returns (bool) {
        return revoked[credentialHash];
    }

    // ================================================================
    // Root revocation — coarse-grained enforcement without circuit changes
    // ================================================================

    function revokeRoot(uint256 root) external {
        require(root != 0, "RevocationRegistry: zero root");
        require(!revokedRoots[root], "RevocationRegistry: root already revoked");
        revokedRoots[root] = true;
        emit RootRevoked(root, msg.sender);
    }

    function restoreRoot(uint256 root) external {
        require(revokedRoots[root], "RevocationRegistry: root not revoked");
        revokedRoots[root] = false;
        emit RootRestored(root, msg.sender);
    }

    function isRootRevoked(uint256 root) external view returns (bool) {
        return revokedRoots[root];
    }

    // ================================================================
    // Nullifier ban — defense-in-depth post-revocation
    // ================================================================

    function revokeNullifier(uint256 nullifier) external {
        require(nullifier != 0, "RevocationRegistry: zero nullifier");
        require(!revokedNullifiers[nullifier], "RevocationRegistry: nullifier already revoked");
        revokedNullifiers[nullifier] = true;
        emit NullifierRevoked(nullifier, msg.sender);
    }

    function restoreNullifier(uint256 nullifier) external {
        require(revokedNullifiers[nullifier], "RevocationRegistry: nullifier not revoked");
        revokedNullifiers[nullifier] = false;
        emit NullifierRestored(nullifier, msg.sender);
    }

    function isNullifierRevoked(uint256 nullifier) external view returns (bool) {
        return revokedNullifiers[nullifier];
    }
}
