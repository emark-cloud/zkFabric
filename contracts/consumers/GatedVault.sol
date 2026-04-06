// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IZKFabric.sol";

/// @title GatedVault — ERC-4626 vault with ZK proof-based access control
/// @notice Demo consumer that requires zkFabric proofs for deposits.
///         Two tiers:
///           - Basic:   any valid ZK proof (KYC >= 1)
///           - Premium: KYC >= 3 (checked via predicateValues in public signals)
///
///         Users submit a ZK proof alongside their deposit. The vault verifies the proof
///         via ZKFabricVerifier, then processes the deposit. Identity is never revealed.
contract GatedVault is ERC4626 {
    IZKFabric public immutable zkFabric;
    uint256 public immutable SCOPE;

    /// @notice Track which addresses have verified (for UI convenience)
    mapping(address => bool) public isVerified;
    mapping(address => bool) public isPremium;

    event UserVerified(address indexed user, bool premium);

    constructor(
        IERC20 asset_,
        address _zkFabric,
        string memory name_,
        string memory symbol_
    ) ERC4626(asset_) ERC20(name_, symbol_) {
        zkFabric = IZKFabric(_zkFabric);
        // Scope is deterministic from the vault identity
        // Reduce mod BN128 field prime so it matches circuit field element
        uint256 BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        SCOPE = uint256(keccak256(abi.encodePacked("zkfabric-gated-vault-v1"))) % BN128_FIELD_PRIME;
    }

    /// @notice Verify with a ZK proof, then deposit.
    /// @param assets Amount of underlying asset to deposit
    /// @param receiver Address to receive vault shares
    /// @param proof Groth16 proof elements
    /// @param publicSignals Circuit public signals (52 elements)
    function depositWithProof(
        uint256 assets,
        address receiver,
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external returns (uint256 shares) {
        // Verify the ZK proof (also records nullifier)
        zkFabric.verifyAndRecord(proof, publicSignals, SCOPE);

        // Check if premium tier (predicateValues[1] >= 3 means KYC tier >= 3)
        // Public signals layout: [0]=allPass, [1]=root, [2]=nullifier, [3]=scope,
        // [4-11]=predicateTypes, [12-19]=predicateValues
        bool premium = false;
        if (publicSignals.length >= 14) {
            // If predicateType for slot[1] is GREATER_EQUAL (2) and value is >= 3
            uint256 slot1Type = publicSignals[5];  // predicateTypes[1]
            uint256 slot1Value = publicSignals[13]; // predicateValues[1]
            if (slot1Type == 2 && slot1Value >= 3) {
                premium = true;
            }
        }

        isVerified[msg.sender] = true;
        isPremium[msg.sender] = premium;

        emit UserVerified(msg.sender, premium);

        // Process the deposit via ERC-4626
        shares = deposit(assets, receiver);
    }

    /// @notice View the scope for this vault (dApps use this to generate proofs)
    function getScope() external view returns (uint256) {
        return SCOPE;
    }
}
