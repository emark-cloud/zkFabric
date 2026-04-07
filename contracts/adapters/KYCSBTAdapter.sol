// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/ICredentialAdapter.sol";
import "../core/ZKFabricRegistry.sol";

/// @title KYCSBTAdapter — Reads HashKey's KYC SBT and registers credentials in zkFabric
/// @notice Reads on-chain KYC status via IKycSBT.getKycInfo(), validates the user is approved,
///         and emits a CredentialIngested event. The actual credential commitment (Poseidon hash)
///         is computed off-chain by the SDK and passed in.
///
///         Credential slot mapping:
///           slot[0] = 1 (credentialType: KYC_SBT)
///           slot[1] = kycTier (1-4)
///           slot[2] = isActive (1 or 0)
///           slot[3] = issuanceTimestamp
///           slot[4] = jurisdictionCode (set by user/SDK)
///           slot[5] = issuerIdentifier (hash of this adapter's address)
///           slot[6] = reserved (0)
///           slot[7] = reserved (0)
contract KYCSBTAdapter is ICredentialAdapter {
    address public immutable kycSBT;
    ZKFabricRegistry public immutable registry;

    /// @notice Credential type constant for KYC SBT
    uint256 public constant CREDENTIAL_TYPE_KYC_SBT = 1;

    event KycDataRead(address indexed user, uint8 level, uint8 status);

    constructor(address _kycSBT, address _registry) {
        kycSBT = _kycSBT;
        registry = ZKFabricRegistry(_registry);
    }

    /// @notice Ingest a credential from the KYC SBT.
    /// @dev The credentialHash is computed off-chain by the SDK using Poseidon.
    ///      This function validates the user's KYC status on-chain, registers the
    ///      identity and credential in the registry, and emits events.
    /// @param user The address whose KYC to read
    /// @param identityCommitment The user's Poseidon(privateKey) commitment
    /// @return credentialHash The credential hash (passed through — computed off-chain)
    function ingestCredential(
        address user,
        uint256 identityCommitment
    ) external override returns (uint256 credentialHash) {
        // Read KYC status from the SBT contract
        (, uint8 level, uint8 status,) =
            IKycSBTReader(kycSBT).getKycInfo(user);

        // Validate: must be approved and have at least BASIC level
        require(status == 1, "KYCSBTAdapter: KYC not approved");
        require(level >= 1, "KYCSBTAdapter: no KYC level");

        emit KycDataRead(user, level, status);

        // Register identity (idempotent — will revert if already registered)
        // In practice, the SDK handles this gracefully
        if (!registry.isIdentityRegistered(identityCommitment)) {
            registry.registerIdentity(identityCommitment);
        }

        // The credential hash is computed off-chain:
        // credentialHash = Poseidon(identityCommitment, 1, level, 1, createTime, jurisdiction, issuerHash, 0, 0)
        // We emit the event with a placeholder — the SDK provides the real hash
        // and calls registerCredential separately after computing it.

        emit CredentialIngested(user, identityCommitment, 0);

        return 0; // Actual hash computed off-chain
    }

    /// @notice Register a pre-computed credential hash.
    /// @dev Called by the SDK after computing Poseidon(identityCommitment, slots[8]) off-chain.
    function registerComputedCredential(
        uint256 identityCommitment,
        uint256 _credentialHash
    ) external {
        require(_credentialHash != 0, "KYCSBTAdapter: zero hash");
        registry.registerCredential(identityCommitment, _credentialHash);
    }

    /// @notice Atomically validate KYC status and register the (off-chain computed)
    ///         credential hash in a single transaction.
    /// @dev Preferred entry point for dApp frontends — replaces the two-call dance of
    ///      `ingestCredential` + `registerComputedCredential` with a single on-chain call
    ///      that puts the adapter on the critical path. Poseidon is still computed
    ///      off-chain because on-chain hashing with 9 inputs would be prohibitively
    ///      expensive (~100k gas per call, dwarfing the rest of the flow).
    function ingestAndRegister(
        address user,
        uint256 identityCommitment,
        uint256 _credentialHash
    ) external returns (uint256) {
        require(_credentialHash != 0, "KYCSBTAdapter: zero hash");

        (, uint8 level, uint8 status,) = IKycSBTReader(kycSBT).getKycInfo(user);
        require(status == 1, "KYCSBTAdapter: KYC not approved");
        require(level >= 1, "KYCSBTAdapter: no KYC level");

        emit KycDataRead(user, level, status);

        if (!registry.isIdentityRegistered(identityCommitment)) {
            registry.registerIdentity(identityCommitment);
        }
        registry.registerCredential(identityCommitment, _credentialHash);

        emit CredentialIngested(user, identityCommitment, _credentialHash);
        return _credentialHash;
    }

    /// @inheritdoc ICredentialAdapter
    function credentialType() external pure override returns (uint256) {
        return CREDENTIAL_TYPE_KYC_SBT;
    }
}

/// @dev Minimal interface to read KYC SBT data (avoids importing the full mock)
interface IKycSBTReader {
    function getKycInfo(address account) external view returns (
        string memory ensName,
        uint8 level,
        uint8 status,
        uint256 createTime
    );
}
