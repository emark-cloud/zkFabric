// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ZKFabricRegistry — Credential registry with off-chain Merkle tree root management
/// @notice Hybrid on-chain/off-chain approach:
///   - On-chain: stores credential hashes, emits events for indexing, manages valid roots
///   - Off-chain: SDK maintains the actual Merkle tree, computes roots
///   - Admin (or authorized service) updates the on-chain root after tree changes
///
/// Keeps a rolling window of recent roots so proofs generated against slightly stale
/// roots remain valid during the update window.
contract ZKFabricRegistry is Ownable {
    uint256 public constant MAX_VALID_ROOTS = 100;

    /// @notice Authorized credential adapters that can register credentials
    mapping(address => bool) public authorizedAdapters;

    /// @notice credential hash => registered
    mapping(uint256 => bool) public credentials;

    /// @notice identity commitment => registered
    mapping(uint256 => bool) public identities;

    /// @notice Rolling window of valid Merkle roots
    uint256[100] public rootHistory;
    uint256 public rootIndex;
    mapping(uint256 => bool) public rootLookup;

    /// @notice Current (latest) root
    uint256 public currentRoot;

    /// @notice Total number of registered credentials
    uint256 public credentialCount;

    event IdentityRegistered(uint256 indexed identityCommitment);
    event CredentialRegistered(
        uint256 indexed identityCommitment,
        uint256 indexed credentialHash,
        address adapter
    );
    event RootUpdated(uint256 indexed oldRoot, uint256 indexed newRoot);
    event AdapterAuthorized(address indexed adapter);
    event AdapterRevoked(address indexed adapter);

    modifier onlyAuthorizedAdapter() {
        require(authorizedAdapters[msg.sender], "ZKFabricRegistry: not authorized adapter");
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ================================================================
    // Admin functions
    // ================================================================

    /// @notice Authorize a credential adapter to register credentials.
    function authorizeAdapter(address adapter) external onlyOwner {
        authorizedAdapters[adapter] = true;
        emit AdapterAuthorized(adapter);
    }

    /// @notice Revoke an adapter's authorization.
    function revokeAdapter(address adapter) external onlyOwner {
        authorizedAdapters[adapter] = false;
        emit AdapterRevoked(adapter);
    }

    /// @notice Update the Merkle root after off-chain tree changes.
    /// @dev Open to any caller so that any user can issue credentials in the demo.
    ///      In production, restrict to owner/adapters/multisig.
    function updateRoot(uint256 newRoot) external {
        require(newRoot != 0, "ZKFabricRegistry: zero root");

        uint256 oldRoot = currentRoot;

        // Remove the oldest root from lookup if we're cycling
        uint256 evictedRoot = rootHistory[rootIndex];
        if (evictedRoot != 0) {
            rootLookup[evictedRoot] = false;
        }

        // Store new root
        rootHistory[rootIndex] = newRoot;
        rootLookup[newRoot] = true;
        rootIndex = (rootIndex + 1) % MAX_VALID_ROOTS;
        currentRoot = newRoot;

        emit RootUpdated(oldRoot, newRoot);
    }

    // ================================================================
    // Adapter functions
    // ================================================================

    /// @notice Register an identity commitment (first step before credentials).
    function registerIdentity(uint256 identityCommitment) external onlyAuthorizedAdapter {
        require(identityCommitment != 0, "ZKFabricRegistry: zero commitment");
        require(!identities[identityCommitment], "ZKFabricRegistry: identity already registered");

        identities[identityCommitment] = true;
        emit IdentityRegistered(identityCommitment);
    }

    /// @notice Register a credential hash for a given identity.
    /// @dev The credential hash is Poseidon(identityCommitment, slot[0..7]).
    ///      The actual Merkle tree insertion happens off-chain; this records the event.
    function registerCredential(
        uint256 identityCommitment,
        uint256 credentialHash
    ) external onlyAuthorizedAdapter {
        require(identityCommitment != 0, "ZKFabricRegistry: zero identity");
        require(credentialHash != 0, "ZKFabricRegistry: zero credential");
        require(!credentials[credentialHash], "ZKFabricRegistry: credential already registered");

        credentials[credentialHash] = true;
        credentialCount++;

        emit CredentialRegistered(identityCommitment, credentialHash, msg.sender);
    }

    // ================================================================
    // View functions
    // ================================================================

    /// @notice Check if a Merkle root is in the valid window.
    function isValidRoot(uint256 root) external view returns (bool) {
        if (root == 0) return false;
        return rootLookup[root];
    }

    /// @notice Check if an identity is registered.
    function isIdentityRegistered(uint256 identityCommitment) external view returns (bool) {
        return identities[identityCommitment];
    }

    /// @notice Check if a credential is registered.
    function isCredentialRegistered(uint256 credentialHash) external view returns (bool) {
        return credentials[credentialHash];
    }
}
