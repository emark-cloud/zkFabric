// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICredentialAdapter {
    /// @notice Ingest a credential from the source and register it in the registry.
    /// @param user The address whose credential to ingest
    /// @param identityCommitment The user's Poseidon identity commitment
    /// @return credentialHash The Poseidon hash of the packed credential data
    function ingestCredential(
        address user,
        uint256 identityCommitment
    ) external returns (uint256 credentialHash);

    /// @notice Returns the credential type identifier for this adapter.
    function credentialType() external pure returns (uint256);

    event CredentialIngested(
        address indexed user,
        uint256 indexed identityCommitment,
        uint256 credentialHash
    );
}
