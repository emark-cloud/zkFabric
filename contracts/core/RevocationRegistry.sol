// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RevocationRegistry — Issuer-controlled credential revocation
/// @notice Issuers (adapter contracts or admin) can revoke/restore credential hashes.
///         dApps can check revocation status before accepting proofs.
contract RevocationRegistry is Ownable {
    /// @notice credential hash => revoked
    mapping(uint256 => bool) public revoked;

    /// @notice Addresses authorized to revoke credentials
    mapping(address => bool) public authorizedIssuers;

    event CredentialRevoked(uint256 indexed credentialHash, address indexed issuer);
    event CredentialRestored(uint256 indexed credentialHash, address indexed issuer);
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

    function revoke(uint256 credentialHash) external onlyIssuer {
        require(!revoked[credentialHash], "RevocationRegistry: already revoked");
        revoked[credentialHash] = true;
        emit CredentialRevoked(credentialHash, msg.sender);
    }

    function restore(uint256 credentialHash) external onlyIssuer {
        require(revoked[credentialHash], "RevocationRegistry: not revoked");
        revoked[credentialHash] = false;
        emit CredentialRestored(credentialHash, msg.sender);
    }

    function isRevoked(uint256 credentialHash) external view returns (bool) {
        return revoked[credentialHash];
    }
}
