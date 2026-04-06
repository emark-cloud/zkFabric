// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockKycSBT — Test mock of HashKey Chain's KycSBT contract
/// @notice Implements the IKycSBT interface for development/testing.
///         In production, this would be replaced with the real KycSBT contract address.
contract MockKycSBT is Ownable {
    enum KycLevel { NONE, BASIC, ADVANCED, PREMIUM, ULTIMATE }
    enum KycStatus { NONE, APPROVED, REVOKED }

    struct KycInfo {
        string ensName;
        KycLevel level;
        KycStatus status;
        uint256 createTime;
    }

    mapping(address => KycInfo) public kycData;
    mapping(address => mapping(string => bool)) public ensApprovals;

    event KycRequested(address indexed user, string ensName);
    event KycLevelUpdated(address indexed user, KycLevel level);
    event KycStatusUpdated(address indexed user, KycStatus status);
    event KycRevoked(address indexed user);
    event KycRestored(address indexed user);
    event AddressApproved(address indexed user);
    event EnsNameApproved(address indexed user, string ensName);

    constructor() Ownable(msg.sender) {}

    /// @notice Admin: set KYC info for a user (for testing)
    function setKycInfo(
        address user,
        string calldata ensName,
        KycLevel level,
        KycStatus status
    ) external onlyOwner {
        kycData[user] = KycInfo({
            ensName: ensName,
            level: level,
            status: status,
            createTime: block.timestamp
        });
        emit KycLevelUpdated(user, level);
        emit KycStatusUpdated(user, status);
    }

    /// @notice Request KYC (mock: auto-approves at BASIC level)
    function requestKyc(string calldata ensName) external payable {
        kycData[msg.sender] = KycInfo({
            ensName: ensName,
            level: KycLevel.BASIC,
            status: KycStatus.APPROVED,
            createTime: block.timestamp
        });
        emit KycRequested(msg.sender, ensName);
        emit KycLevelUpdated(msg.sender, KycLevel.BASIC);
        emit KycStatusUpdated(msg.sender, KycStatus.APPROVED);
    }

    function getKycInfo(address account) external view returns (
        string memory ensName,
        uint8 level,
        uint8 status,
        uint256 createTime
    ) {
        KycInfo storage info = kycData[account];
        return (info.ensName, uint8(info.level), uint8(info.status), info.createTime);
    }

    function isHuman(address account) external view returns (bool isValid, uint8 level) {
        KycInfo storage info = kycData[account];
        isValid = info.status == KycStatus.APPROVED;
        level = uint8(info.level);
    }

    function revokeKyc(address user) external onlyOwner {
        kycData[user].status = KycStatus.REVOKED;
        emit KycRevoked(user);
    }

    function restoreKyc(address user) external onlyOwner {
        kycData[user].status = KycStatus.APPROVED;
        emit KycRestored(user);
    }

    function approveEnsName(address user, string calldata ensName) external onlyOwner {
        ensApprovals[user][ensName] = true;
        emit EnsNameApproved(user, ensName);
    }

    function isEnsNameApproved(address user, string calldata ensName) external view returns (bool) {
        return ensApprovals[user][ensName];
    }
}
