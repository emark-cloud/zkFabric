// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/ICredentialAdapter.sol";
import "../core/ZKFabricRegistry.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ZKTLSAdapter — Accepts off-chain attestation proofs and registers credentials
/// @notice In production, this would verify Reclaim Protocol proofs on-chain.
///         For the hackathon, it accepts attestations signed by a trusted attestor.
///         The architecture is the same: off-chain data source → on-chain verification → credential registration.
///
///         Credential slot mapping:
///           slot[0] = 2 (credentialType: ZKTLS)
///           slot[1] = primaryAttribute (e.g., credit score band)
///           slot[2] = isActive (1)
///           slot[3] = issuanceTimestamp
///           slot[4] = jurisdictionCode
///           slot[5] = issuerIdentifier (hash of attestor address)
///           slot[6] = auxiliaryData1 (provider-specific)
///           slot[7] = auxiliaryData2 (provider-specific)
contract ZKTLSAdapter is ICredentialAdapter {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    ZKFabricRegistry public immutable registry;

    /// @notice Trusted attestor address (in production: Reclaim attestor network)
    address public attestor;
    address public owner;

    uint256 public constant CREDENTIAL_TYPE_ZKTLS = 2;

    /// @notice Prevent replay of attestations
    mapping(bytes32 => bool) public usedAttestations;

    event AttestationVerified(address indexed user, bytes32 indexed attestationId);
    event AttestorUpdated(address indexed oldAttestor, address indexed newAttestor);

    modifier onlyOwner() {
        require(msg.sender == owner, "ZKTLSAdapter: not owner");
        _;
    }

    constructor(address _registry, address _attestor) {
        registry = ZKFabricRegistry(_registry);
        attestor = _attestor;
        owner = msg.sender;
    }

    function setAttestor(address _attestor) external onlyOwner {
        emit AttestorUpdated(attestor, _attestor);
        attestor = _attestor;
    }

    /// @notice Submit an attestation proof and register the credential.
    /// @param user The user address the attestation is for
    /// @param identityCommitment The user's identity commitment
    /// @param attestationData ABI-encoded attestation payload (provider, claim data, timestamp)
    /// @param signature Attestor's ECDSA signature over the attestation
    function submitAttestation(
        address user,
        uint256 identityCommitment,
        bytes calldata attestationData,
        bytes calldata signature
    ) external returns (uint256) {
        // Compute attestation ID for replay protection
        bytes32 attestationId = keccak256(attestationData);
        require(!usedAttestations[attestationId], "ZKTLSAdapter: attestation already used");

        // Verify the attestor's signature
        bytes32 messageHash = keccak256(abi.encodePacked(user, identityCommitment, attestationData));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        require(recovered == attestor, "ZKTLSAdapter: invalid attestor signature");

        // Mark attestation as used
        usedAttestations[attestationId] = true;

        // Register identity if not already registered
        if (!registry.isIdentityRegistered(identityCommitment)) {
            registry.registerIdentity(identityCommitment);
        }

        emit AttestationVerified(user, attestationId);
        emit CredentialIngested(user, identityCommitment, 0);

        return 0; // Credential hash computed off-chain
    }

    /// @notice Register a pre-computed credential hash (called by SDK after Poseidon computation)
    function registerComputedCredential(
        uint256 identityCommitment,
        uint256 credentialHash
    ) external {
        require(credentialHash != 0, "ZKTLSAdapter: zero hash");
        registry.registerCredential(identityCommitment, credentialHash);
    }

    /// @inheritdoc ICredentialAdapter
    function ingestCredential(
        address,
        uint256
    ) external pure override returns (uint256) {
        revert("ZKTLSAdapter: use submitAttestation() instead");
    }

    /// @inheritdoc ICredentialAdapter
    function credentialType() external pure override returns (uint256) {
        return CREDENTIAL_TYPE_ZKTLS;
    }
}
